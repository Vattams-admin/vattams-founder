import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/types/database";

type MockView = "ready" | "attempt" | "result";

type MockQuestion = {
  id: string;
  question_id: string;
  course_id: string;
  question: string;
  question_type?: string;
  topic?: string;
  subtopic?: string;
  options?: string[];
  marks: number;
  time_seconds: number;
  is_published?: boolean;
};

type MockAttempt = {
  id: string;
  student_id: string;
  course_id: string;
  status: "in_progress" | "submitted" | string;
  started_at?: { toMillis?: () => number };
  question_ids?: string[];
};

type QuestionFeedback = {
  submitted: boolean;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
};

type MockResult = {
  score: number;
  maxScore: number;
  answeredCount: number;
};

type CompetitionMockTestProps = {
  course: Course;
};

const MOCK_QUESTION_COUNT = 30;

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function CompetitionMockTest({
  course,
}: CompetitionMockTestProps) {
  const [view, setView] = useState<MockView>("ready");
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, QuestionFeedback>>(
    {},
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [result, setResult] = useState<MockResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const autoSubmitRef = useRef(false);

  const totalSeconds = useMemo(
    () =>
      questions.reduce(
        (sum, question) =>
          sum + Math.max(1, Number(question.time_seconds) || 60),
        0,
      ),
    [questions],
  );

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.question_id] ?? ""
    : "";
  const currentFeedback = currentQuestion
    ? feedback[currentQuestion.question_id]
    : undefined;

  const answeredCount = questions.filter(
    (question) => (answers[question.question_id] ?? "").trim() !== "",
  ).length;

  const loadQuestions = async (questionIds: string[]) => {
    const snapshots = await Promise.all(
      questionIds.map((questionId) =>
        getDoc(doc(firestore, "competition_questions", questionId)),
      ),
    );

    const loadedQuestions = snapshots
      .map((snapshot) =>
        snapshot.exists()
          ? ({
              id: snapshot.id,
              ...snapshot.data(),
            } as MockQuestion)
          : null,
      )
      .filter(
        (question): question is MockQuestion =>
          question !== null &&
          question.is_published !== false &&
          question.course_id === course.id &&
          question.question_type === "Multiple Choice" &&
          Array.isArray(question.options) &&
          question.options.length === 4 &&
          new Set(question.options).size === 4 &&
          question.options.every(
            (option) => typeof option === "string" && option.trim() !== "",
          ),
      );

    if (loadedQuestions.length !== MOCK_QUESTION_COUNT) {
      throw new Error(
        `Unable to load all ${MOCK_QUESTION_COUNT} selected mock questions.`,
      );
    }

    const questionMap = new Map(
      loadedQuestions.map((question) => [question.question_id, question]),
    );

    return questionIds.map((questionId) => {
      const question = questionMap.get(questionId);

      if (!question) {
        throw new Error(`Selected mock question ${questionId} is unavailable.`);
      }

      return question;
    });
  };

  const loadExistingMockAttempt = async () => {
    const user = firebaseAuth.currentUser;

    if (!user) {
      return false;
    }

    const attemptSnapshot = await getDocs(
      query(
        collection(firestore, "competition_mock_attempts"),
        where("student_id", "==", user.uid),
      ),
    );

    const attempts = attemptSnapshot.docs.map(
      (attemptDoc): MockAttempt => ({
        id: attemptDoc.id,
        ...(attemptDoc.data() as Omit<MockAttempt, "id">),
      }),
    );

    const activeAttempt = attempts.find(
      (attempt) =>
        attempt.course_id === course.id && attempt.status === "in_progress",
    );

    if (!activeAttempt) {
      return false;
    }

    const selectedQuestionIds = Array.isArray(activeAttempt.question_ids)
      ? activeAttempt.question_ids.filter(
          (id): id is string => typeof id === "string" && id.trim() !== "",
        )
      : [];

    if (
      selectedQuestionIds.length !== MOCK_QUESTION_COUNT ||
      new Set(selectedQuestionIds).size !== MOCK_QUESTION_COUNT
    ) {
      throw new Error("This mock attempt has an invalid question set.");
    }

    const loadedQuestions = await loadQuestions(selectedQuestionIds);

    const answerSnapshot = await getDocs(
      collection(
        firestore,
        "competition_mock_attempts",
        activeAttempt.id,
        "answers",
      ),
    );

    const restoredAnswers: Record<string, string> = {};

    answerSnapshot.docs.forEach((answerDoc) => {
      const data = answerDoc.data();

      if (typeof data.answer === "string") {
        restoredAnswers[answerDoc.id] = data.answer;
      }
    });

    const savedStart =
      activeAttempt.started_at?.toMillis?.() ?? Date.now();

    setQuestions(loadedQuestions);
    setAttemptId(activeAttempt.id);
    setStartedAtMs(savedStart);
    setAnswers(restoredAnswers);
    setFeedback({});
    setCurrentIndex(0);

    const elapsedSeconds = Math.floor(
      (Date.now() - savedStart) / 1000,
    );

    setRemainingSeconds(
      Math.max(
        0,
        loadedQuestions.reduce(
          (sum, question) =>
            sum + Math.max(1, Number(question.time_seconds) || 60),
          0,
        ) - elapsedSeconds,
      ),
    );

    setView("attempt");
    return true;
  };

  const startMockTest = async () => {
    const user = firebaseAuth.currentUser;

    if (!user || busy) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const resumed = await loadExistingMockAttempt();

      if (resumed) {
        return;
      }

      const token = await user.getIdToken();

      const { data, error } = await supabase.functions.invoke(
        "competition-question-pool",
        {
          body: {
            course_id: course.id,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (error) {
        let detail = error.message || "Unable to select mock questions.";

        try {
          const context = (error as { context?: Response }).context;

          if (context) {
            const body = await context.clone().text();

            if (body) {
              detail += ` | HTTP ${context.status} | ${body}`;
            }
          }
        } catch {
          // Keep the original error when the response body cannot be read.
        }

        throw new Error(detail);
      }

      const questionIds = Array.isArray(data?.question_ids)
        ? data.question_ids.filter(
            (id: unknown): id is string =>
              typeof id === "string" && id.trim() !== "",
          )
        : [];

      if (
        questionIds.length !== MOCK_QUESTION_COUNT ||
        new Set(questionIds).size !== MOCK_QUESTION_COUNT
      ) {
        throw new Error(
          `Question pool returned an invalid set of ${questionIds.length} questions.`,
        );
      }

      const loadedQuestions = await loadQuestions(questionIds);

      const attemptRef = doc(
        collection(firestore, "competition_mock_attempts"),
      );

      await setDoc(attemptRef, {
        student_id: user.uid,
        course_id: course.id,
        status: "in_progress",
        started_at: serverTimestamp(),
        question_ids: questionIds,
        is_mock: true,
      });

      setQuestions(loadedQuestions);
      setAttemptId(attemptRef.id);
      setStartedAtMs(Date.now());
      setAnswers({});
      setFeedback({});
      setCurrentIndex(0);

      const mockTotalSeconds = loadedQuestions.reduce(
        (sum, question) =>
          sum + Math.max(1, Number(question.time_seconds) || 60),
        0,
      );

      setRemainingSeconds(mockTotalSeconds);
      setView("attempt");
    } catch (error) {
      console.error("Failed to start mock test:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the mock test. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveAnswer = async (questionId: string, value: string) => {
    if (!attemptId || feedback[questionId]?.submitted) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));

    try {
      await setDoc(
        doc(
          firestore,
          "competition_mock_attempts",
          attemptId,
          "answers",
          questionId,
        ),
        {
          question_id: questionId,
          answer: value,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Failed to save mock answer:", error);
      setErrorMessage("Answer could not be saved. Please try again.");
    }
  };

  const submitAnswer = async () => {
    if (
      !attemptId ||
      !currentQuestion ||
      !currentAnswer ||
      currentFeedback?.submitted ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const user = firebaseAuth.currentUser;

      if (!user) {
        throw new Error(
          "Your Firebase session has expired. Please sign in again.",
        );
      }

      const token = await user.getIdToken();

      const { data, error } = await supabase.functions.invoke(
        "competition-mock-scoring",
        {
          body: {
            action: "check_answer",
            attemptId,
            questionId: currentQuestion.question_id,
            answer: currentAnswer,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (error) {
        throw error;
      }

      setFeedback((previous) => ({
        ...previous,
        [currentQuestion.question_id]: {
          submitted: true,
          correct: Boolean(data?.correct),
          correctAnswer: String(data?.correctAnswer || ""),
          explanation: String(data?.explanation || ""),
        },
      }));
    } catch (error) {
      console.error("Failed to check mock answer:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to check this answer. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitMockTest = async () => {
    if (
      !attemptId ||
      !questions.length ||
      busy ||
      autoSubmitRef.current
    ) {
      return;
    }

    autoSubmitRef.current = true;
    setBusy(true);
    setErrorMessage("");

    try {
      const firebaseUser = firebaseAuth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          "Your Firebase session has expired. Please sign in again.",
        );
      }

      const token = await firebaseUser.getIdToken();

      const { data, error } = await supabase.functions.invoke(
        "competition-mock-scoring",
        {
          body: {
            action: "submit_mock",
            attemptId,
            answers: questions.map((question) => ({
              questionId: question.question_id,
              answer: answers[question.question_id] ?? "",
            })),
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (error) {
        throw error;
      }

      setResult({
        score: Number(data?.score) || 0,
        maxScore: Number(data?.maxScore) || 0,
        answeredCount: Number(data?.answeredCount) || 0,
      });

      setView("result");
    } catch (error) {
      console.error("Failed to submit mock test:", error);

      autoSubmitRef.current = false;

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit the mock test. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (
      view !== "attempt" ||
      !attemptId ||
      startedAtMs === null ||
      totalSeconds <= 0
    ) {
      return;
    }

    const updateTimer = () => {
      const elapsedSeconds = Math.floor(
        (Date.now() - startedAtMs) / 1000,
      );

      const remaining = Math.max(0, totalSeconds - elapsedSeconds);

      setRemainingSeconds(remaining);

      if (remaining === 0 && !autoSubmitRef.current) {
        void submitMockTest();
      }
    };

    updateTimer();

    const timer = window.setInterval(updateTimer, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [view, attemptId, startedAtMs, totalSeconds]);

  if (view === "ready") {
    return (
      <section className="mt-8">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Mock Test
          </span>

          <h2 className="mt-3 font-display text-2xl font-semibold">
            {course.name}
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-muted">
            Practice with 30 randomly selected objective questions from your
            age-appropriate competition question pool.
          </p>

          {errorMessage && (
            <div className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={() => void startMockTest()}
            disabled={busy}
            className="btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Preparing Mock Test..." : "Start Mock Test"}
          </button>
        </div>
      </section>
    );
  }

  if (view === "attempt" && currentQuestion) {
    const options = currentQuestion.options ?? [];

    return (
      <section className="mt-8">
        <div className="card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                Mock Test
              </span>

              <h2 className="mt-2 font-display text-xl font-semibold">
                {course.name}
              </h2>
            </div>

            <div className="rounded-card border border-gold/20 bg-white/5 px-4 py-2 text-center">
              <p className="text-[11px] text-slate-muted">Time</p>
              <p className="mt-1 font-semibold">
                {formatTime(remainingSeconds)}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-muted">
              Question {currentIndex + 1} of {questions.length}
            </span>

            <span className="text-slate-muted">
              Answered {answeredCount}/{questions.length}
            </span>
          </div>

          <div className="mt-5 rounded-card border border-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                {currentQuestion.topic || "Question"}
              </span>

              <span className="text-xs text-slate-muted">
                {currentQuestion.marks}{" "}
                {currentQuestion.marks === 1 ? "mark" : "marks"}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-semibold leading-8">
              {currentQuestion.question}
            </h3>

            <div className="mt-7 space-y-3">
              {options.map((option, index) => {
                const selected = currentAnswer === option;
                const isCorrect =
                  currentFeedback?.submitted &&
                  option === currentFeedback.correctAnswer;

                const isWrongSelection =
                  currentFeedback?.submitted &&
                  selected &&
                  !currentFeedback.correct;

                return (
                  <button
                    key={`${currentQuestion.question_id}-${index}`}
                    type="button"
                    onClick={() =>
                      void saveAnswer(
                        currentQuestion.question_id,
                        option,
                      )
                    }
                    disabled={busy || currentFeedback?.submitted}
                    className={`w-full rounded-card border px-4 py-4 text-left text-sm transition ${
                      isCorrect
                        ? "border-success/50 bg-success/10 text-success"
                        : isWrongSelection
                          ? "border-danger/50 bg-danger/10 text-danger"
                          : selected
                            ? "border-gold bg-gold/15 text-gold"
                            : "border-white/10 bg-black/20 hover:border-gold/40"
                    } disabled:cursor-not-allowed`}
                  >
                    <span className="mr-3 font-semibold">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {!currentFeedback?.submitted && (
              <button
                type="button"
                onClick={() => void submitAnswer()}
                disabled={!currentAnswer || busy}
                className="btn-primary mt-7 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Checking..." : "Submit Answer"}
              </button>
            )}

            {currentFeedback?.submitted && (
              <div
                className={`mt-7 rounded-card border px-4 py-4 ${
                  currentFeedback.correct
                    ? "border-success/30 bg-success/10"
                    : "border-danger/30 bg-danger/10"
                }`}
              >
                <p
                  className={`font-semibold ${
                    currentFeedback.correct
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {currentFeedback.correct ? "✓ Correct" : "✗ Wrong"}
                </p>

                <p className="mt-2 text-sm">
                  <span className="font-semibold">Correct answer:</span>{" "}
                  {currentFeedback.correctAnswer}
                </p>

                {currentFeedback.explanation && (
                  <p className="mt-3 text-sm leading-7 text-slate-muted">
                    <span className="font-semibold text-white">
                      Explanation:
                    </span>{" "}
                    {currentFeedback.explanation}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) => Math.max(0, index - 1))
                }
                disabled={currentIndex === 0 || busy}
                className="btn-secondary disabled:opacity-40"
              >
                Previous
              </button>

              <div className="flex flex-wrap gap-3">
                {currentIndex < questions.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((index) =>
                        Math.min(questions.length - 1, index + 1),
                      )
                    }
                    disabled={!currentFeedback?.submitted || busy}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                )}

                {currentIndex === questions.length - 1 &&
                  currentFeedback?.submitted && (
                    <button
                      type="button"
                      onClick={() => void submitMockTest()}
                      disabled={busy}
                      className="rounded-card border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Submitting..." : "Finish Mock Test"}
                    </button>
                  )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {questions.map((question, index) => {
              const answered =
                (answers[question.question_id] ?? "").trim() !== "";
              const checked =
                feedback[question.question_id]?.submitted === true;

              return (
                <button
                  key={question.question_id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-9 min-w-9 rounded-full border px-2 text-xs ${
                    index === currentIndex
                      ? "border-gold bg-gold/20 text-gold"
                      : checked
                        ? feedback[question.question_id].correct
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-danger/40 bg-danger/10 text-danger"
                        : answered
                          ? "border-gold/40 bg-gold/10 text-gold"
                          : "border-white/10 text-slate-muted"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (view === "result" && result) {
    return (
      <section className="mt-8">
        <div className="card p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Mock Test completed
          </p>

          <h2 className="mt-4 font-display text-2xl font-semibold">
            {course.name}
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-white/10 p-5">
              <p className="text-sm text-slate-muted">Score</p>
              <p className="mt-2 text-3xl font-bold text-gold">
                {result.score}
              </p>
            </div>

            <div className="rounded-card border border-white/10 p-5">
              <p className="text-sm text-slate-muted">Maximum</p>
              <p className="mt-2 text-3xl font-bold">
                {result.maxScore}
              </p>
            </div>

            <div className="rounded-card border border-white/10 p-5">
              <p className="text-sm text-slate-muted">Answered</p>
              <p className="mt-2 text-3xl font-bold">
                {result.answeredCount}/{questions.length}
              </p>
            </div>
          </div>

          <p className="mt-7 text-sm leading-7 text-slate-muted">
            Review your answers and explanations above while preparing for
            the official competition.
          </p>
        </div>
      </section>
    );
  }

  return null;
}
