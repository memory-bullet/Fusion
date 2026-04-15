import { prisma } from "@/lib/prisma";

/** 历史版本自动生成的协作文稿标题，不再展示也不再生效 */
export const LEGACY_AUTO_DOC_TITLES = new Set(["项目概述", "任务拆解", "成员协作记录"]);

/** 不再为新建项目自动生成上述默认文档（保留函数供调用方兼容）。 */
export async function ensureDefaultProjectDocuments(_projectId: string) {
  const count = await prisma.projectDocument.count({ where: { projectId: _projectId } });
  if (count > 0) return;
  return;
}
