import { TaskStatus, WarningLevel } from "@/lib/domain";

export type DashboardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  workloadPoints: number;
  deadline: string;
  warningLevel: WarningLevel;
  isReallocated: boolean;
  assignee: { id: string; name: string } | null;
};

export type DashboardData = {
  project: {
    id: string;
    title: string;
    contextSummary: string;
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
  logs: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  files: Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    mimeType: string;
    status: string;
    createdAt: string;
    author: string;
    downloadUrl: string;
  }>;
};
