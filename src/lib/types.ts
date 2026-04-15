import type { AssignmentMilestone } from "@/lib/assignment-milestones";
import { TaskStatus, WarningLevel } from "@/lib/domain";

export type TaskUltimatumLevel = "NONE" | "WARN_3D" | "RED_24H";

export type DashboardTask = {
  id: string;
  title: string;
  sourceLabel?: string | null;
  status: TaskStatus;
  workloadPoints: number;
  createdAt?: string;
  deadline: string;
  warningLevel: WarningLevel;
  ultimatumLevel?: TaskUltimatumLevel;
  isReallocated: boolean;
  assignee: { id: string; name: string } | null;
};

export type DashboardDocument = {
  id: string;
  title: string;
  content: string;
  description: string;
  originalFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  /** 非空表示本地磁盘上的作业文件，可经 API 下载/预览 */
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
};

export type DashboardData = {
  /** 未带成员 Cookie 打开链接时为 true，仅浏览聚合数据 */
  isGuest?: boolean;
  /** 项目创建者，可编辑任务草稿并确认写入 */
  isOwner: boolean;
  project: {
    id: string;
    title: string;
    contextSummary: string;
    keyDeliverables?: string[] | null;
    assignmentMilestones?: AssignmentMilestone[] | null;
    deadline: string;
    inviteCode: string;
    progressDigest?: string | null;
    progressDigestAt?: string | null;
  };
  me: {
    id: string;
    name: string;
    accumulatedPoints: number;
    creditScore: number;
    email?: string | null;
  } | null;
  members: Array<{
    id: string;
    name: string;
    accumulatedPoints: number;
    creditScore: number;
    /** ProjectMember.role：OWNER | MEMBER */
    role: string;
  }>;
  tasks: DashboardTask[];
  logs: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  documents: DashboardDocument[];
};
