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

export default function AssessmentRunner({ courseId, assessmentId, title }: Props) {
  const [view, setView] = useState<View>("ready");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [attemptId, setAttemptId] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoSubmit = useRef(false);
  const saveTimers = useRef<Record<string, number>>({});

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

    const byId = new Map(loaded.map((q) => [q.question_id, q]));
    const ordered = ids.map((id) => byId.get(id));
    if (ordered.some((q) => !q)) throw new Error("Assessment question ordering is invalid.");

    const restored: Record<string, number | null> = {};
    for (const answer of (Array.isArray(data?.answers) ? data.answers : []) as AssessmentAnswer[]) {
      if (typeof answer.question_id === "string") {
        restored[answer.question_id] = Number.isInteger(answer.selected_option_index)
          ? answer.selected_option_index as number
          : null;
      }
    }

    setQuestions(ordered as AssessmentQuestion[]);
    setAnswers(restored);
    setAttemptId(data.attempt_id);
    const started = typeof data.started_at === "string" ? Date.parse(data.started_at) : NaN;
    const startMs = Number.isFinite(started) ? started : Date.now();
    setStartedAt(startMs);

    const configuredSeconds = (ordered as AssessmentQuestion[]).reduce(
      (sum, q) => sum + Math.max(1, Number(q.time_seconds) || 60), 0,
    );
    setRemainingSeconds(Math.max(0, configuredSeconds - Math.floor((Date.now() - startMs) / 1000)));
    setView(data.status === "submitted" ? "result" : "attempt");
  }, [assessmentId, courseId]);

  const saveAnswer = useCallback(async (questionId: string, selected: number | null) => {
    if (!attemptId) return;
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));

    const existing = saveTimers.current[questionId];
    if (existing) window.clearTimeout(existing);

    saveTimers.current[questionId] = window.setTimeout(async () => {
      try {
        const authToken = await token();
        await supabase.functions.invoke("assessment-answer", {
          body: {
            action: "save_answer",
            attempt_id: attemptId,
            question_id: questionId,
            selected_option_index: selected,
            answer: selected === null ? "" : String(selected),
          },
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (e) {
        console.error("Assessment answer save failed", e);
        setError("Answer could not be saved. Please retry before submitting.");
      }
    }, 250);
  }, [attemptId]);

  const submit = useCallback(async () => {
    if (!attemptId || busy || autoSubmit.current) return;
    autoSubmit.current = true;
    setBusy(true);
    setError("");
    try {
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
      setError(e instanceof Error ? e.message : "Unable to submit assessment.");
    } finally {
      setBusy(false);
    }
  }, [attemptId, busy]);

  useEffect(() => {
    if (view !== "attempt" || startedAt === null) return;
    const tick = () => {
      const configuredSeconds = questions.reduce(
        (sum, q) => sum + Math.max(1, Number(q.time_seconds) || 60), 0,
      );
      const remaining = Math.max(0, configuredSeconds - Math.floor((Date.now() - startedAt) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !autoSubmit.current) void submit();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [questions, startedAt, submit, view]);

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
      setError(e instanceof Error ? e.message : "Unable to start assessment.");
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
    return (
      <section className="mt-8">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Assessment Result</span>
          <h2 className="mt-3 font-display text-2xl font-semibold">{title}</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-white/10 p-5"><p className="text-sm text-slate-muted">Score</p><p className="mt-2 text-3xl font-bold text-gold">{result.score}</p></div>
            <div className="rounded-card border border-white/10 p-5"><p className="text-sm text-slate-muted">Maximum</p><p className="mt-2 text-3xl font-bold">{result.max_score}</p></div>
            <div className="rounded-card border border-white/10 p-5"><p className="text-sm text-slate-muted">Answered</p><p className="mt-2 text-3xl font-bold">{result.answered_count}/{questions.length}</p></div>
          </div>
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

        {error && <div className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="mt-6 flex items-center justify-between text-sm text-slate-muted">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>Answered {answeredCount}/{questions.length}</span>
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
                  className={`w-full rounded-card border px-4 py-4 text-left text-sm transition ${selected ? "border-gold bg-gold/15 text-gold" : "border-white/10 bg-black/20 hover:border-gold/40"} disabled:opacity-60`}>
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
              className={`h-9 min-w-9 rounded-full border px-2 text-xs ${index === currentIndex ? "border-gold bg-gold/20 text-gold" : Number.isInteger(answers[question.question_id]) ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 text-slate-muted"}`}>
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
