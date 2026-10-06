import { useParams } from "react-router-dom";
import AssessmentRunner from "@/components/assessment/AssessmentRunner";

export default function AssessmentPage() {
  const { courseId, assessmentId } = useParams<{ courseId: string; assessmentId: string }>();

  if (!courseId || !assessmentId) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-muted">Assessment link is incomplete.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AssessmentRunner
        courseId={courseId}
        assessmentId={assessmentId}
        title={assessmentId.replace(/[-_]/g, " ")}
      />
    </div>
  );
}
