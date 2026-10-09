import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";

type AssessmentQuestion = {
  question_id: string;
  question: string;
  options: [string, string, string, string];
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: "easy" | "medium" | "hard";
  language: string;
  marks: number;
  time_seconds: number;
};

type AssessmentAnswer = {
  question_id: string;
  answer?: string;
  selected_option_index?: number | null;
};

type AssessmentResult = {
  attempt_id: string;
  score: number;
  max_score: number;
  answered_count: number;
};

type Props = {
  courseId: string;
  assessmentId: string;
  title: string;
};

type View = "ready" | "attempt" | "result";

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

async function token() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Your Firebase session has expired. Please sign in again.");
  return user.getIdToken();
}

function assessmentRecoveryMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (normalized.includes("session has expired") || normalized.includes("jwt") || normalized.includes("unauthorized") || normalized.includes("401")) {
    return "Your sign-in session may have expired. Sign in again, then reopen this assessment to resume your saved attempt.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("timeout") || normalized.includes("fetch")) {
    return "We couldn't reach the assessment service. Check your internet connection and retry. Your existing attempt has not been intentionally reset.";
  }
  if (normalized.includes("question set is incomplete") || normalized.includes("question ordering is invalid") || normalized.includes("invalid attempt")) {
    return "The saved assessment data could not be loaded completely. Retry once; if the problem continues, contact support and include the assessment title.";
  }
  return message || fallback;
}

export default function AssessmentRunner({ courseId, assessmentId, title }: Props) {
  const [view, setView] = useState<View>("ready");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [attemptId, setAttemptId] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [assessmentTimeSeconds, setAssessmentTimeSeconds] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewUnansweredOnly, setReviewUnansweredOnly] = useState(false);
  const [reviewTopic, setReviewTopic] = useState("all");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [answerSyncState, setAnswerSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const autoSubmit = useRef(false);
  const timeoutSubmissionAttempted = useRef(false);
  const saveTimers = useRef<Record<string, number>>({});
  const pendingAnswers = useRef<Record<string, number | null>>({});
  const answerSaveChains = useRef<Record<string, Promise<void>>>({});

  const current = questions[currentIndex];
  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => Number.isInteger(v)).length,
    [answers],
  );

  const loadAttempt = useCallback(async () => {
    const authToken = await token();
    const { data, error: invokeError } = await supabase.functions.invoke("assessment-attempt", {
      body: { action: "start_or_resume", course_id: courseId, assessment_id: assessmentId },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (invokeError) throw invokeError;

    const ids = Array.isArray(data?.question_ids) ? data.question_ids.filter((x: unknown): x is string => typeof x === "string") : [];
    if (!data?.attempt_id || !ids.length || new Set(ids).size !== ids.length) {
      throw new Error("Assessment returned an invalid attempt.");
    }

    const { data: content, error: contentError } = await supabase.functions.invoke("assessment-question-content", {
      body: { action: "load", attempt_id: data.attempt_id },
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (contentError) throw contentError;

    const loaded = Array.isArray(content?.questions) ? content.questions as AssessmentQuestion[] : [];
    if (loaded.length !== ids.length) throw new Error("Assessment question set is incomplete.");

    const byId = new Map(loaded.map((q: AssessmentQuestion) => [q.question_id, q]));
    const ordered = ids.map((id: string) => byId.get(id));
    if (ordered.some((q: AssessmentQuestion | undefined) => !q)) throw new Error("Assessment question ordering is invalid.");

    const orderedQuestions = ordered as AssessmentQuestion[];
    const validQuestionIds = new Set(orderedQuestions.map((question) => question.question_id));
    const restored: Record<string, number | null> = {};
    for (const answer of (Array.isArray(data?.answers) ? data.answers : []) as AssessmentAnswer[]) {
      if (typeof answer.question_id !== "string" || !validQuestionIds.has(answer.question_id)) continue;
      const selected = answer.selected_option_index;
      restored[answer.question_id] =
        Number.isInteger(selected) && (selected as number) >= 0 && (selected as number) < 4
          ? selected as number
          : null;
    }

    setQuestions(orderedQuestions);
    setCurrentIndex(0);
    setAnswers(restored);
    setAttemptId(data.attempt_id);
    const configuredSeconds = Number(data?.time_seconds);
    if (!Number.isFinite(configuredSeconds) || configuredSeconds <= 0) throw new Error("Assessment returned an invalid time limit.");
    setAssessmentTimeSeconds(configuredSeconds);

    if (data.status === "submitted" && data.result) {
      setResult({
        attempt_id: data.attempt_id,
        score: Number(data.result.score) || 0,
        max_score: Number(data.result.max_score) || 0,
        answered_count: Number(data.result.answered_count) || 0,
      });
      setView("result");
      return;
    }

    const started = typeof data.started_at === "string" ? Date.parse(data.started_at) : NaN;
    const startMs = Number.isFinite(started) ? started : Date.now();
    setStartedAt(startMs);

    setRemainingSeconds(Math.max(0, configuredSeconds - Math.floor((Date.now() - startMs) / 1000)));
    setView("attempt");
  }, [assessmentId, courseId]);

  const persistAnswer = useCallback(async (questionId: string, selected: number | null) => {
    // Serialize writes per question so a slower, older request cannot overwrite a newer selection.
    const previous = answerSaveChains.current[questionId] ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const authToken = await token();
      const { error: saveError } = await supabase.functions.invoke("assessment-answer", {
        body: {
          action: "save_answer",
          attempt_id: attemptId,
          question_id: questionId,
          selected_option_index: selected,
          answer: selected === null ? "" : String(selected),
        },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (saveError) throw saveError;
      if (pendingAnswers.current[questionId] === selected) {
        delete pendingAnswers.current[questionId];
      }
    });
    answerSaveChains.current[questionId] = operation;
    try {
      await operation;
    } finally {
      if (answerSaveChains.current[questionId] === operation) {
        delete answerSaveChains.current[questionId];
      }
    }
  }, [attemptId]);

  const saveAnswer = useCallback(async (questionId: string, selected: number | null) => {
    if (!attemptId) return;
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
    pendingAnswers.current[questionId] = selected;
    setAnswerSyncState("saving");

    const existing = saveTimers.current[questionId];
    if (existing) window.clearTimeout(existing);

    saveTimers.current[questionId] = window.setTimeout(() => {
      delete saveTimers.current[questionId];
      void persistAnswer(questionId, selected).then(() => {
        if (Object.keys(pendingAnswers.current).length === 0) setAnswerSyncState("saved");
      }).catch((e) => {
        console.error("Assessment answer save failed", e);
        setAnswerSyncState("error");
        setError("Answer could not be saved. Please retry before submitting.");
      });
    }, 250);
  }, [attemptId, persistAnswer]);

  const retryPendingSaves = useCallback(async () => {
    if (!attemptId || busy) return;
    setBusy(true);
    setError("");
    try {
      for (const timer of Object.values(saveTimers.current)) window.clearTimeout(timer);
      saveTimers.current = {};
      await Promise.all(
        Object.entries(pendingAnswers.current).map(([questionId, selected]) =>
          persistAnswer(questionId, selected),
        ),
      );
      setError("");
      setAnswerSyncState("saved");
    } catch (e) {
      console.error("Assessment answer retry failed", e);
      setAnswerSyncState("error");
      setError(assessmentRecoveryMessage(e, "Answers could not be saved. Check your connection and retry."));
    } finally {
      setBusy(false);
    }
  }, [attemptId, busy, persistAnswer]);

  const submit = useCallback(async () => {
    if (!attemptId || busy || autoSubmit.current) return;
    autoSubmit.current = true;
    setBusy(true);
    setError("");
    try {
      // Flush debounced answers before submission so the server scores the latest selections.
      const pending = Object.entries(pendingAnswers.current);
      for (const timer of Object.values(saveTimers.current)) window.clearTimeout(timer);
      saveTimers.current = {};
      await Promise.all(pending.map(([questionId, selected]) => persistAnswer(questionId, selected)));

      const authToken = await token();
      const { data, error: invokeError } = await supabase.functions.invoke("assessment-submit", {
        body: { action: "submit", attempt_id: attemptId },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (invokeError) throw invokeError;
      setResult({
        attempt_id: attemptId,
        score: Number(data?.score) || 0,
        max_score: Number(data?.max_score) || 0,
        answered_count: Number(data?.answered_count) || 0,
      });
      setView("result");
    } catch (e) {
      autoSubmit.current = false;
      setError(assessmentRecoveryMessage(e, "Unable to submit assessment. Please retry."));
    } finally {
      setBusy(false);
    }
  }, [attemptId, busy, persistAnswer]);

  useEffect(() => {
    if (view !== "attempt" || startedAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, assessmentTimeSeconds - Math.floor((Date.now() - startedAt) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !timeoutSubmissionAttempted.current && !autoSubmit.current) {
        timeoutSubmissionAttempted.current = true;
        void submit();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [assessmentTimeSeconds, startedAt, submit, view]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach((id) => window.clearTimeout(id));
  }, []);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await loadAttempt();
    } catch (e) {
      setError(assessmentRecoveryMessage(e, "Unable to start assessment. Please retry."));
    } finally {
      setBusy(false);
    }
  };

  if (view === "ready") {
    return (
      <section className="mt-8">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Assessment</span>
          <h2 className="mt-3 font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-muted">
            Start or resume your self-learning assessment. Your progress is saved without requiring a tutor or live session.
          </p>
          {error && <div className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
          <button type="button" onClick={() => void start()} disabled={busy} className="btn-primary mt-6 disabled:opacity-50">
            {busy ? "Preparing Assessment..." : "Start / Resume"}
          </button>
        </div>
      </section>
    );
  }

  if (view === "result" && result) {
    const scorePercent = result.max_score > 0
      ? Math.round((result.score / result.max_score) * 100)
      : null;
    const unansweredCount = Math.max(0, questions.length - result.answered_count);
    return (
      <section className="mt-8">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Assessment Result</span>
          <h2 className="mt-3 font-display text-2xl font-semibold">{title}</h2>
          <div className="mt-7 rounded-card border border-gold/20 bg-gold/5 p-5">
            <p className="text-sm text-slate-muted">Your score percentage</p>
            <p className="mt-2 text-3xl font-bold text-gold">{scorePercent === null ? "—" : `${scorePercent}%`}</p>
            <p className="mt-2 text-sm text-slate-muted">
              {scorePercent === null
                ? "This assessment did not return a score maximum, so a percentage cannot be calculated."
                : scorePercent >= 80
                  ? "Strong result. Review any unanswered questions and revisit topics you found difficult."
                  : scorePercent >= 50
                    ? "Good progress. Review the lesson material for topics that need more practice."
                    : "Use this attempt as a learning guide: revisit the lessons and practise the topics again."}
            </p>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-white/10 p-5"><p className="text-sm text-slate-muted">Score</p><p className="mt-2 text-3xl font-bold text-gold">{result.score}</p></div>
            <div className="rounded-card border border-white/10 p-5"><p className="text-sm text-slate-muted">Maximum</p><p className="mt-2 text-3xl font-bold">{result.max_score}</p></div>
            <div className="rounded-card border border-white/10 p-5"><p className="text-sm text-slate-muted">Answered</p><p className="mt-2 text-3xl font-bold">{result.answered_count}/{questions.length}</p></div>
          </div>
          {unansweredCount > 0 && (
            <p className="mt-4 rounded-card border border-white/10 p-4 text-sm text-slate-muted">
              {unansweredCount} {unansweredCount === 1 ? "question was" : "questions were"} left unanswered. Consider reviewing those topics before your next attempt.
            </p>
          )}
          <div className="mt-7">
            <h3 className="font-display text-lg font-semibold">Topic revision guide</h3>
            <p className="mt-1 text-sm text-slate-muted">
              Use these topic counts to choose what to revise next. They show coverage and unanswered responses, not topic-level correctness.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from(
                questions.reduce((groups, question) => {
                  const topic = question.topic?.trim() || "General review";
                  const group = groups.get(topic) ?? { total: 0, unanswered: 0 };
                  group.total += 1;
                  if (!Number.isInteger(answers[question.question_id])) group.unanswered += 1;
                  groups.set(topic, group);
                  return groups;
                }, new Map<string, { total: number; unanswered: number }>()),
                ([topic, counts]) => ({ topic, ...counts })
              ).map(({ topic, total, unanswered }) => (
                <li key={topic} className="rounded-card border border-white/10 p-4">
                  <p className="font-medium">{topic}</p>
                  <p className="mt-2 text-sm text-slate-muted">
                    {total} {total === 1 ? "question" : "questions"}
                    {unanswered > 0 ? ` · ${unanswered} unanswered` : " · All answered"}
                  </p>
                  <p className="mt-2 text-xs text-slate-muted">
                    {unanswered > 0
                      ? "Suggested focus: revisit this topic and try answering without help."
                      : "Suggested focus: revisit the lesson and practise a fresh question set."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewTopic(topic);
                      setReviewUnansweredOnly(false);
                      document.getElementById("assessment-response-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="btn-secondary mt-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    Review this topic
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <details id="assessment-response-review" className="mt-7 rounded-card border border-white/10 p-4 sm:p-5">
            <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <span className="font-display text-lg font-semibold">Your response review</span>
              <span className="mt-1 block text-sm text-slate-muted">
                Review {questions.length} {questions.length === 1 ? "question" : "questions"} and your saved answers.
              </span>
            </summary>
            <p className="mt-4 text-sm text-slate-muted">
              Identify questions to revisit. Correct-answer explanations are shown only when the assessment service provides them.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="assessment-review-topic" className="mb-1 block text-sm font-medium">Filter by topic</label>
                <select
                  id="assessment-review-topic"
                  value={reviewTopic}
                  onChange={(event) => setReviewTopic(event.target.value)}
                  className="w-full rounded-card border border-white/15 bg-slate-900 px-3 py-2 text-sm text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <option value="all">All topics</option>
                  {Array.from(new Set(questions.map((question) => question.topic?.trim() || "General review"))).sort((a, b) => a.localeCompare(b)).map((topic) => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </div>
              {reviewTopic !== "all" && (
                <button
                  type="button"
                  onClick={() => setReviewTopic("all")}
                  className="btn-secondary text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Clear topic filter
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-muted" aria-live="polite" aria-atomic="true">
                Showing {questions.filter((question) => {
                  const answered = Number.isInteger(answers[question.question_id]);
                  const topic = question.topic?.trim() || "General review";
                  return (reviewTopic === "all" || topic === reviewTopic) && (!reviewUnansweredOnly || !answered);
                }).length} of {questions.length} questions
                {reviewUnansweredOnly ? " · unanswered only" : ""}
                {reviewTopic !== "all" ? ` · ${reviewTopic}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setReviewUnansweredOnly((value) => !value)}
                aria-pressed={reviewUnansweredOnly}
                className="btn-secondary text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {reviewUnansweredOnly ? "Show all questions" : "Review unanswered only"}
              </button>
            </div>
            {reviewUnansweredOnly && questions.every((question) => Number.isInteger(answers[question.question_id])) ? (
              <p className="mt-4 rounded-card border border-white/10 p-4 text-sm text-slate-muted" role="status">
                All questions have been answered. There are no unanswered questions to review.
              </p>
            ) : (
              {questions.every((question) => {
              const answered = Number.isInteger(answers[question.question_id]);
              const topic = question.topic?.trim() || "General review";
              return (reviewTopic !== "all" && topic !== reviewTopic) || (reviewUnansweredOnly && answered);
            }) ? (
              <p className="mt-4 rounded-card border border-white/10 p-4 text-sm text-slate-muted" role="status">
                No questions match these filters. Clear the topic filter or show all questions.
              </p>
            ) : (
            <ol className="mt-4 space-y-3">
              {questions.map((question, index) => {
                const selectedIndex = answers[question.question_id];
                const answered = Number.isInteger(selectedIndex) && selectedIndex !== null;
                const topic = question.topic?.trim() || "General review";
                if (reviewTopic !== "all" && topic !== reviewTopic) return null;
                if (reviewUnansweredOnly && answered) return null;
                return (
                  <li key={question.question_id} className="rounded-card border border-white/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">Question {index + 1}: {question.question}</p>
                      <span className={`rounded-full border px-2 py-1 text-xs ${answered ? "border-white/15 text-parchment" : "border-gold/30 text-gold"}`}>
                        {answered ? "Answered" : "Unanswered"}
                      </span>
                    </div>
                    {answered ? (
                      <p className="mt-3 text-sm text-slate-muted">
                        Your answer: <span className="text-parchment">{String.fromCharCode(65 + (selectedIndex as number))}. {question.options[selectedIndex as number]}</span>
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-slate-muted">No answer was selected for this question.</p>
                    )}
                    <p className="mt-2 text-xs text-slate-muted">Topic: {question.topic}</p>
                  </li>
                );
              })}
            </ol>
            )}
          </details>
        </div>
      </section>
    );
  }

  if (!current) return null;

  return (
    <section className="mt-8">
      <div className="card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div><span className="text-xs font-semibold uppercase tracking-wide text-gold">Self-learning Assessment</span><h2 className="mt-2 font-display text-xl font-semibold">{title}</h2></div>
          <div className="rounded-card border border-gold/20 bg-white/5 px-4 py-2 text-center"><p className="text-[11px] text-slate-muted">Time</p><p className="mt-1 font-semibold">{formatTime(remainingSeconds)}</p></div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <p>{assessmentRecoveryMessage(error, error)}</p>
            {Object.keys(pendingAnswers.current).length > 0 && (
              <button type="button" onClick={() => void retryPendingSaves()} disabled={busy}
                className="mt-3 rounded-card border border-danger/40 px-3 py-2 font-semibold text-danger underline underline-offset-4 disabled:opacity-50">
                {busy ? "Retrying saves..." : "Retry saving answers"}
              </button>
            )}
            {remainingSeconds === 0 && (
              <>
                <button type="button" onClick={() => void submit()} disabled={busy}
                  className="ml-2 mt-3 rounded-card border border-danger/40 px-3 py-2 font-semibold text-danger underline underline-offset-4 disabled:opacity-50">
                  {busy ? "Retrying submission..." : "Retry submission"}
                </button>
                <button type="button" onClick={() => void start()} disabled={busy}
                  className="ml-2 mt-3 rounded-card border border-danger/40 px-3 py-2 font-semibold text-danger underline underline-offset-4 disabled:opacity-50">
                  {busy ? "Checking status..." : "Check submission status"}
                </button>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-slate-muted">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>Answered {answeredCount}/{questions.length}</span>
        </div>
        <p className="mt-2 text-xs text-slate-muted" role="status" aria-live="polite" aria-atomic="true">
          {answerSyncState === "saving"
            ? "Saving your answers…"
            : answerSyncState === "saved"
              ? "All answer changes saved."
              : answerSyncState === "error"
                ? "An answer could not be saved. Retry saving before submitting."
                : "Choose an option to record your answer."}
        </p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Assessment navigation progress"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={currentIndex + 1}
          aria-valuetext={`Question ${currentIndex + 1} of ${questions.length}`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="mt-5 rounded-card border border-white/10 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gold">{current.topic}</span>
            <span className="text-xs text-slate-muted">{current.marks} {current.marks === 1 ? "mark" : "marks"}</span>
          </div>
          <h3 className="mt-5 text-lg font-semibold leading-8">{current.question}</h3>

          <div className="mt-7 space-y-3">
            {current.options.map((option, index) => {
              const selected = answers[current.question_id] === index;
              return (
                <button key={`${current.question_id}-${index}`} type="button"
                  onClick={() => void saveAnswer(current.question_id, index)}
                  disabled={busy}
                  aria-pressed={selected}
                  className={`w-full rounded-card border px-4 py-4 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${selected ? "border-gold bg-gold/15 text-gold" : "border-white/10 bg-black/20 hover:border-gold/40"} disabled:opacity-60`}>
                  <span className="mr-3 font-semibold">{String.fromCharCode(65 + index)}.</span>{option}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0 || busy} className="btn-secondary disabled:opacity-40">Previous</button>
            <div className="flex gap-3">
              {currentIndex < questions.length - 1 ? (
                <button type="button" onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={busy} className="btn-primary disabled:opacity-40">Next</button>
              ) : (
                <button type="button" onClick={() => void submit()} disabled={busy} className="btn-primary disabled:opacity-40">{busy ? "Submitting..." : "Submit Assessment"}</button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {questions.map((question, index) => (
            <button key={question.question_id} type="button" onClick={() => setCurrentIndex(index)}
              aria-label={`Go to question ${index + 1}${Number.isInteger(answers[question.question_id]) ? ", answered" : ", unanswered"}`}
              aria-current={index === currentIndex ? "step" : undefined}
              className={`h-9 min-w-9 rounded-full border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${index === currentIndex ? "border-gold bg-gold/20 text-gold" : Number.isInteger(answers[question.question_id]) ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 text-slate-muted"}`}>
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
