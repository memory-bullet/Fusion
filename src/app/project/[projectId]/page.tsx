import { ProjectDashboard } from "./project-dashboard";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDashboard projectId={projectId} />;
}
