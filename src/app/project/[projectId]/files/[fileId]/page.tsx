import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/auth";

export default async function ProjectFilePreviewPage({
  params
}: {
  params: Promise<{ projectId: string; fileId: string }>;
}) {
  const { projectId, fileId } = await params;
  await requireProjectMember(projectId);

  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId }
  });

  if (!file) {
    return <main className="min-h-screen bg-white p-10 text-slate-900">文件不存在。</main>;
  }

  const contentUrl = `/api/projects/${projectId}/files/${fileId}/content`;
  const isPdf = file.mimeType === "application/pdf";
  const isImage = file.mimeType.startsWith("image/");
  const isAudio = file.mimeType.startsWith("audio/");
  const isVideo = file.mimeType.startsWith("video/");

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-6 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="text-sm text-slate-500">在线预览</div>
          <h1 className="mt-2 text-2xl font-semibold">{file.originalName}</h1>
          <div className="mt-2 text-sm text-slate-500">类型：{file.mimeType}</div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          {isPdf ? (
            <iframe src={contentUrl} className="h-[78vh] w-full rounded-[18px]" title={file.originalName} />
          ) : isImage ? (
            <img src={contentUrl} alt={file.originalName} className="max-h-[78vh] w-full rounded-[18px] object-contain" />
          ) : isAudio ? (
            <audio src={contentUrl} controls className="w-full" />
          ) : isVideo ? (
            <video src={contentUrl} controls className="max-h-[78vh] w-full rounded-[18px]" />
          ) : (
            <iframe src={contentUrl} className="h-[78vh] w-full rounded-[18px]" title={file.originalName} />
          )}
        </div>
      </div>
    </main>
  );
}
