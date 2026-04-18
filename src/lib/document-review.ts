import { prisma } from "@/lib/prisma";

export type DocumentReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export function isDocumentPendingReview(status: string, isOwner: boolean, authorId: string, currentUserId: string) {
  return status === "PENDING" && !isOwner && authorId === currentUserId;
}

export async function awardDocumentPoints(args: {
  documentId: string;
  projectId: string;
  userId: string;
  reviewerId?: string;
  points: number;
  fileName: string;
}) {
  const { documentId, projectId, userId, reviewerId, points, fileName } = args;

  await prisma.$transaction([
    prisma.projectDocument.update({
      where: { id: documentId },
      data: {
        reviewStatus: "APPROVED",
        reviewComment: "",
        reviewedBy: reviewerId ?? null,
        reviewedAt: new Date(),
        pointsAwarded: points
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { accumulatedPoints: { increment: points } }
    }),
    prisma.actionLog.create({
      data: {
        projectId,
        userId: reviewerId ?? userId,
        actionType: "DOCUMENT_APPROVED",
        description: `审核通过作业文件：${fileName}｜文档ID=${documentId}｜积分 +${points}`
      }
    })
  ]);
}
