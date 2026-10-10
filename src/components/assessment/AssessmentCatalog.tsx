import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseAuth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";

type Assessment = {
  assessment_id: string;
  slug: string;
  title: string;
  domain: string;
  kind: string;
  question_count: number;
  time_seconds: number;
  pass_percent: number | null;
};

type Props = { courseId: string };

function label(kind: string) {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function duration(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

export default function AssessmentCatalog({ courseId }: Props) {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeKind, setActiveKind] = useState("all");
  const assessmentKinds = Array.from(new Set(assessments.map((assessment) => assessment.kind)))
    .sort((a, b) => label(a).localeCompare(label(b)));

  const filteredAssessments = assessments.filter((assessment) => {
    if (activeKind !== "all" && assessment.kind !== activeKind) return false;
    const term = searchTerm.trim().toLocaleLowerCase();
    if (!term) return true;
    return [assessment.title, assessment.domain, assessment.kind, assessment.slug]
      .some((value) => value.toLocaleLowerCase().includes(term));
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const user = firebaseAuth.currentUser;
        if (!user) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const authToken = await user.getIdToken();
        const { data, error } = await supabase.functions.invoke("assessment-catalog", {
          body: { course_id: courseId },
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (error) throw error;
        if (!cancelled) setAssessments(Array.isArray(data?.assessments) ? data.assessments : []);
      } catch (error) {
        console.error("Assessment catalog load failed:", error);
        if (!cancelled) {
          setAssessments([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [courseId, retryToken]);

  if (loading) {
    return (
      <section className="card mt-6 p-6" aria-live="polite">
        <p className="text-sm text-slate-muted">Loading assessments…</p>
      </section>
    );
  }

  return (
    <section className="card mt-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Self-Learning Assessments</p>
          <h2 className="mt-2 font-display text-xl">Practice, tests & mock exams</h2>
          <p className="mt-2 text-sm text-slate-muted">
            Continue independently. No tutor assignment or live session is required.
          </p>
        </div>
      </div>

      {!loadError && assessments.length > 0 && (
        <div className="mt-5">
          <label htmlFor="assessment-catalog-search" className="mb-2 block text-sm font-medium text-parchment/90">
            Find a practice set or mock exam
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="assessment-catalog-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, subject, or assessment type…"
              className="input min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="btn-secondary text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Clear search
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter assessments by type">
            <button
              type="button"
              onClick={() => setActiveKind("all")}
              aria-pressed={activeKind === "all"}
              className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${activeKind === "all" ? "border-gold bg-gold/15 text-gold" : "border-white/15 text-parchment hover:border-gold/50"}`}
            >
              All types
            </button>
            {assessmentKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setActiveKind(kind)}
                aria-pressed={activeKind === kind}
                className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${activeKind === kind ? "border-gold bg-gold/15 text-gold" : "border-white/15 text-parchment hover:border-gold/50"}`}
              >
                {label(kind)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-muted" aria-live="polite" aria-atomic="true">
            Showing {filteredAssessments.length} of {assessments.length} assessments
            {searchTerm.trim() ? ` for “${searchTerm.trim()}”` : ''}
            {activeKind !== "all" ? ` · Type: ${label(activeKind)}` : ''}
          </p>
        </div>
      )}

      {loadError ? (
        <div className="mt-5 rounded-card border border-danger/30 p-4">
          <p className="text-sm text-slate-muted">Assessments could not be loaded. Please try again.</p>
          <button
            type="button"
            onClick={() => setRetryToken((token) => token + 1)}
            className="btn-secondary mt-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Retry assessments
          </button>
        </div>
      ) : assessments.length === 0 ? (
        <p className="mt-5 rounded-card border border-white/10 p-4 text-sm text-slate-muted">
          No published assessments are available for this course yet. Check back later for practice and mock exams.
        </p>
      ) : filteredAssessments.length === 0 ? (
        <div className="mt-5 rounded-card border border-white/10 p-4">
          <p className="text-sm text-slate-muted">No assessments match the current search and type filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("")
              setActiveKind("all")
            }}
            className="btn-secondary mt-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {filteredAssessments.map((assessment) => (
          <button
            key={assessment.assessment_id}
            type="button"
            onClick={() => navigate(`/assessment/${courseId}/${assessment.assessment_id}`)}
            className="rounded-card border border-white/10 bg-black/10 p-4 text-left transition hover:border-gold/40 hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-gold">
              {label(assessment.kind)}
            </span>
            <h3 className="mt-2 font-semibold">{assessment.title}</h3>
            {assessment.domain.trim() && (
              <p className="mt-1 text-xs text-slate-muted">Subject / domain: {assessment.domain}</p>
            )}
            <p className="mt-2 text-xs text-slate-muted">
              {assessment.question_count} questions · {duration(assessment.time_seconds)}
              {assessment.pass_percent != null ? ` · Pass ${assessment.pass_percent}%` : ""}
            </p>
            <span className="mt-4 inline-flex text-sm font-semibold text-gold">Start / Resume →</span>
          </button>
        ))}
      </div>
      )}
    </section>
  );
}
