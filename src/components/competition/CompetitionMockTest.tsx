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

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

export default function CompetitionMockTest({
  course,
}: CompetitionMockTestProps) {
  const [view, setView] = useState<MockView>("ready");
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

  const answeredCount = questions.filter(
    (question) => (answers[question.question_id] ?? "").trim() !== "",
  ).length;

  const loadExistingMockAttempt = async () => {
    const user = firebaseAuth.currentUser;

    if (!user) return false;

    const attemptSnapshot = await getDocs(
      query(
        collection(firestore, "competition_mock_attempts"),
        where("student_id", "==", user.uid),
      ),
    );

    const attempts = attemptSnapshot.docs.map((attemptDoc): MockAttempt => ({
      id: attemptDoc.id,
      ...(attemptDoc.data() as Omit<MockAttempt, "id">),
    }));

    const activeAttempt = attempts.find(
      (attempt) =>
        attempt.course_id === course.id && attempt.status === "in_progress",
    );

    if (!activeAttempt) {
      return false;
    }

    const selectedQuestionIds = Array.isArray(activeAttempt.question_ids)
      ? activeAttempt.question_ids.filter(
          (id): id is string => typeof id === "string" && /^TKR-FULL-/.test(id),
        )
      : [];

    if (
      selectedQuestionIds.length !== MOCK_QUESTION_COUNT ||
      new Set(selectedQuestionIds).size !== MOCK_QUESTION_COUNT
    ) {
      throw new Error("This mock attempt has an invalid question set.");
    }

    const questionSnapshots = await Promise.all(
      selectedQuestionIds.map((questionId) =>
        getDoc(doc(firestore, "competition_questions", questionId)),
      ),
    );

    const questionMap = new Map(
      questionSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => [
          snapshot.id,
          {
            id: snapshot.id,
            ...snapshot.data(),
          } as MockQuestion,
        ]),
    );

    const loadedQuestions = selectedQuestionIds
      .map((questionId) => questionMap.get(questionId))
      .filter(
        (question): question is MockQuestion =>
          question !== undefined &&
          question.is_published !== false &&
          question.course_id === course.id &&
          /^TKR-FULL-/.test(question.question_id),
      );

    if (loadedQuestions.length !== MOCK_QUESTION_COUNT) {
      throw new Error(
        `Unable to load all ${MOCK_QUESTION_COUNT} mock questions.`,
      );
    }

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

    const savedStart = activeAttempt.started_at?.toMillis?.() ?? Date.now();

    setQuestions(loadedQuestions);
    setAttemptId(activeAttempt.id);
    setStartedAtMs(savedStart);
    setAnswers(restoredAnswers);
    setCurrentIndex(0);

    const elapsedSeconds = Math.floor((Date.now() - savedStart) / 1000);

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

    if (!user || busy) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const resumed = await loadExistingMockAttempt();

      if (resumed) {
        return;
      }

      const indexSnapshot = await getDoc(
        doc(firestore, "competition_question_indexes", course.id),
      );

      if (!indexSnapshot.exists()) {
        throw new Error("Competition question bank is not configured yet.");
      }

      const indexData = indexSnapshot.data();
      const totalQuestions = Number(indexData.total_questions) || 0;
      const perAttempt = Number(indexData.per_attempt) || MOCK_QUESTION_COUNT;
      const modules = indexData.modules as Record<string, unknown> | undefined;

      if (
        totalQuestions < MOCK_QUESTION_COUNT ||
        perAttempt !== MOCK_QUESTION_COUNT ||
        !modules ||
        typeof modules !== "object"
      ) {
        throw new Error("Competition question bank configuration is invalid.");
      }

      const allQuestionIds = Object.values(modules)
        .filter(Array.isArray)
        .flat()
        .filter(
          (id): id is string => typeof id === "string" && /^TKR-FULL-/.test(id),
        );

      if (
        allQuestionIds.length !== totalQuestions ||
        new Set(allQuestionIds).size !== totalQuestions
      ) {
        throw new Error("Competition question bank index failed validation.");
      }

      const selectedQuestionIds = shuffle(allQuestionIds).slice(
        0,
        MOCK_QUESTION_COUNT,
      );

      if (selectedQuestionIds.length !== MOCK_QUESTION_COUNT) {
        throw new Error("Unable to select enough questions for the mock test.");
      }

      const questionSnapshots = await Promise.all(
        selectedQuestionIds.map((questionId) =>
          getDoc(doc(firestore, "competition_questions", questionId)),
        ),
      );

      const loadedQuestions = questionSnapshots
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
            /^TKR-FULL-/.test(question.question_id),
        );

      if (loadedQuestions.length !== MOCK_QUESTION_COUNT) {
        throw new Error(
          `Unable to load all ${MOCK_QUESTION_COUNT} selected mock questions.`,
        );
      }

      const attemptRef = doc(
        collection(firestore, "competition_mock_attempts"),
      );

      await setDoc(attemptRef, {
        student_id: user.uid,
        course_id: course.id,
        status: "in_progress",
        started_at: serverTimestamp(),
        question_ids: selectedQuestionIds,
        is_mock: true,
      });

      setQuestions(loadedQuestions);
      setAttemptId(attemptRef.id);
      setStartedAtMs(Date.now());
      setAnswers({});
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

  const submitMockTest = async () => {
    if (!attemptId || !questions.length || busy || autoSubmitRef.current) {
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

      const scoreData = data as {
        score?: number;
        maxScore?: number;
        answeredCount?: number;
      };

      setResult({
        score: Number(scoreData.score) || 0,
        maxScore: Number(scoreData.maxScore) || 0,
        answeredCount: Number(scoreData.answeredCount) || answeredCount,
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
    if (view !== "attempt" || !attemptId || !startedAtMs || totalSeconds <= 0) {
      return;
    }

    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - startedAtMs) / 1000);

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

  const saveAnswer = async (questionId: string, value: string) => {
    if (!attemptId) return;

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

  if (view === "attempt" && currentQuestion) {
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
                {currentQuestion.marks} mark
                {currentQuestion.marks === 1 ? "" : "s"}
              </span>
            </div>

            <h3 className="mt-5 text-lg font-semibold leading-8">
              {currentQuestion.question}
            </h3>

            <label
              htmlFor={`mock-answer-${currentQuestion.question_id}`}
              className="mt-7 block text-sm font-medium"
            >
              Your answer
            </label>

            <textarea
              id={`mock-answer-${currentQuestion.question_id}`}
              value={answers[currentQuestion.question_id] ?? ""}
              onChange={(event) =>
                void saveAnswer(currentQuestion.question_id, event.target.value)
              }
              placeholder="Type your answer here..."
              rows={4}
              className="mt-2 w-full rounded-card border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-gold/50"
            />

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
                    disabled={busy}
                    className="btn-primary disabled:opacity-40"
                  >
                    Next
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void submitMockTest()}
                  disabled={busy}
                  className="rounded-card border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Submitting..." : "Submit Mock Test"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {questions.map((question, index) => {
              const answered =
                (answers[question.question_id] ?? "").trim() !== "";

              return (
                <button
                  key={question.question_id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-9 min-w-9 rounded-full border px-2 text-xs ${
                    index === currentIndex
                      ? "border-gold bg-gold/20 text-gold"
                      : answered
                        ? "border-success/40 bg-success/10 text-success"
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
            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-muted">Score</p>
              <p className="mt-2 text-2xl font-bold">{result.score}</p>
            </div>

            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-muted">Maximum</p>
              <p className="mt-2 text-2xl font-bold">{result.maxScore}</p>
            </div>

            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-muted">Answered</p>
              <p className="mt-2 text-2xl font-bold">{result.answeredCount}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setView("ready");
              setResult(null);
              setAttemptId(null);
              setQuestions([]);
              setAnswers({});
              setCurrentIndex(0);
              setRemainingSeconds(0);
              autoSubmitRef.current = false;
            }}
            className="btn-secondary mt-8"
          >
            Back to Mock Test
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="rounded-card border border-gold/20 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Practice
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">
              Mock Test
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-muted">
              Practice with 30 randomly selected questions from the competition
              question bank. Mock Test activity is separate from your official
              competition attempt.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void startMockTest()}
            disabled={busy}
            className="btn-primary disabled:opacity-50"
          >
            {busy ? "Starting..." : "Start Mock Test"}
          </button>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        )}
      </div>
    </section>
  );
}
