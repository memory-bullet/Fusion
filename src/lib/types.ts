import { TaskStatus, WarningLevel } from "@/lib/domain";

export type DashboardTask = {
  id: string;
  title: string;
  sourceLabel?: string | null;
  status: TaskStatus;
  workloadPoints: number;
  deadline: string;
  warningLevel: WarningLevel;
  isReallocated: boolean;
  assignee: { id: string; name: string } | null;
};

export type DashboardFile = {
  id: string;
  name: string;
  uploaderId: string;
  uploader: string;
  uploadedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  previewUrl: string;
};

export type DashboardData = {
  /** 项目创建者，可编辑任务草稿并确认写入 */
  isOwner: boolean;
  project: {
    id: string;
    title: string;
    contextSummary: string;
    keyDeliverables?: string[] | null;
    deadline: string;
    inviteCode: string;
  };
  me: {
    id: string;
    name: string;
    accumulatedPoints: number;
    creditScore: number;
  };
  members: Array<{
    id: string;
    name: string;
    accumulatedPoints: number;
    creditScore: number;
  }>;
  tasks: DashboardTask[];
  files: DashboardFile[];
  logs: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
};
