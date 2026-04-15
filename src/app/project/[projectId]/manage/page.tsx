import { ProjectManagePage } from "@/components/project-manage-page";

export default async function ManagePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectManagePage projectId={projectId} />;
}
