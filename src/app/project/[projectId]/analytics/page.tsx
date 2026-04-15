import { Suspense } from "react";
import { ProjectAnalyticsPage } from "@/components/project-analytics-page";

export default async function AnalyticsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f8f9fa] p-8">Loading...</main>}>
      <ProjectAnalyticsPage projectId={projectId} />
    </Suspense>
  );
}
