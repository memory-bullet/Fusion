import type { AssignmentMilestone } from "@/lib/assignment-milestones";
import { TaskStatus, WarningLevel } from "@/lib/domain";

export type TaskUltimatumLevel = "NONE" | "WARN_3D" | "RED_24H";
export type JoinedStatus = "ACTIVATED" | "NOT_ACTIVATED";

export type TaskNote = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type MemberPreset = {
  id: string;
  projectId: string;
  presetName: string;
  activated: boolean;
  activatedBy?: string | null;
  createdAt: string;
};

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
  deletedAt?: string | null;
  /** 任务创建者 ID，用于判断成员是否有权删除自己创建的任务 */
  createdById?: string | null;
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
    /** 用户 ID：用于任务负责人、认领、指派等与 Task.assigneeId 对齐 */
    userId: string;
    name: string;
    accumulatedPoints: number;
    creditScore: number;
    /** ProjectMember.role：OWNER | MEMBER */
    role: string;
    joinedStatus: JoinedStatus;
    /** 项目内昵称（优先显示，为空则显示 name） */
    projectNickname?: string | null;
  }>;
  presets?: MemberPreset[];
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
