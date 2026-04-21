"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Plus, X, Users, ChevronRight, FileText, Sparkles, ArrowRight } from "lucide-react";
import { InviteQrScanner } from "@/components/invite-qr-scanner";
import { PersonalCenter } from "@/components/personal-center";
import { DraftSpaceCard } from "@/components/draft-space-card";
import { ProjectCardMenu } from "@/components/project-card-menu";
import { DateTimeConfirmField } from "@/components/datetime-confirm-field";

type MyProjectRow = {
  id: string;
  title: string;
  role: string;
  inviteCode: string;
  deadline: string;
};

const ui = {
  shell: "mx-auto w-full max-w-3xl px-5 pb-28 pt-10 sm:px-6",
  card: "rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm",
  field:
    "w-full rounded-xl border-0 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 ring-1 ring-inset ring-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900",
  btnPrimary:
    "w-full rounded-xl bg-neutral-900 py-3 text-center text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50",
  btnGhostDark:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800",
  muted: "text-sm text-neutral-500",
  label: "mb-1 block text-xs font-medium text-neutral-500"
} as const;

// 草稿空间空状态插画组件
function EmptyDraftSpace() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="relative mb-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <FileText className="h-9 w-9 text-neutral-400" />
        </div>
        <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-neutral-900">还没有任务草稿</h3>
      <p className="mt-2 max-w-xs text-sm text-neutral-500 leading-relaxed">
        上传作业要求或直接创建任务，AI 会帮你拆解成可执行的小任务
      </p>
      <div className="mt-4 rounded-lg bg-neutral-50 px-4 py-3 text-left text-xs text-neutral-500 leading-relaxed max-w-xs">
        <p className="font-medium text-neutral-700 mb-1">试试这样说：</p>
        <p>
          「帮我在 5 月 1 日前完成开题报告，包括文献综述、研究方法和进度安排」
        </p>
      </div>
    </div>
  );
}

// 项目卡片
function ProjectCard({
  project,
  onEnter,
  onRename,
  onDelete,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging
}: {
  project: MyProjectRow;
  onEnter: (id: string) => void;
  onRename: (projectId: string, newTitle: string) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const isOwner = project.role === "OWNER";
  const deadline = new Date(project.deadline);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const deadlineColor = daysLeft < 0 ? "text-red-500" : daysLeft <= 3 ? "text-amber-500" : "text-neutral-400";

  return (
    <div
      className={`${ui.card} flex items-center gap-3 transition hover:border-neutral-300 hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      }`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
        {project.title.charAt(0)}
      </div>
      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => onEnter(project.id)}
        role="button"
        data-button-hover="off"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onEnter(project.id)}
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-neutral-900">{project.title}</span>
          {isOwner && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
              创建者
            </span>
          )}
          {!isOwner && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
              成员
            </span>
          )}
        </div>
        <p className={`text-xs ${deadlineColor} mt-0.5`}>
          {daysLeft < 0
            ? `已截止 ${Math.abs(daysLeft)} 天`
            : daysLeft === 0
            ? "今日截止"
            : `还剩 ${daysLeft} 天`}
        </p>
      </div>
      <ProjectCardMenu
        projectId={project.id}
        projectTitle={project.title}
        inviteCode={project.inviteCode}
        onRename={(newTitle) => onRename(project.id, newTitle)}
        onDelete={() => onDelete(project.id)}
        dragHandleProps={
          draggable
            ? {
                onMouseDown: (e: React.MouseEvent) => e.stopPropagation()
              }
            : undefined
        }
      />
      <button
        type="button"
        onClick={() => onEnter(project.id)}
        className="shrink-0 rounded-lg p-1.5 text-neutral-300 hover:bg-neutral-50 hover:text-neutral-600"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  // 登录用户信息
  const [sessionUser, setSessionUser] = useState<{ name: string; email: string | null } | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  // 项目列表
  const [myProjects, setMyProjects] = useState<MyProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  // 新建项目表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  /** YYYY-MM-DDTHH:mm，仅在选择器内点「确定」后写入 */
  const [createDeadline, setCreateDeadline] = useState("");
  const [createOwnerName, setCreateOwnerName] = useState("");
  const [presetInputs, setPresetInputs] = useState<string[]>([""]);
  // 加入项目表单
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinPresetId, setJoinPresetId] = useState<string | null>(null);
  const [inviteScanOpen, setInviteScanOpen] = useState(false);
  // 错误提示
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 读取登录状态
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSessionUser(d.user ?? null))
      .catch(() => setSessionUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  // 从 URL 带入邀请码参数（含 S3 presetId）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite")?.trim();
    const preset = params.get("preset")?.trim();
    if (code) {
      setJoinInviteCode(code);
      if (preset) setJoinPresetId(preset);
      setShowJoinForm(true);
    }
  }, []);

  // 读取项目列表
  useEffect(() => {
    if (!sessionUser) {
      setMyProjects([]);
      return;
    }
    setProjectsLoading(true);
    fetch("/api/projects/mine", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) { setMyProjects([]); return; }
        const d = (await r.json()) as { projects?: MyProjectRow[] };
        setMyProjects(Array.isArray(d.projects) ? d.projects : []);
      })
      .catch(() => setMyProjects([]))
      .finally(() => setProjectsLoading(false));
  }, [sessionUser]);

  const isRegistered = Boolean(sessionUser?.email);
  const canUseApp = authReady && isRegistered;

  // 更新全局昵称
  async function handleUpdateNickname(newName: string) {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "更新失败");
    }
    const data = await res.json();
    setSessionUser(data.user);
  }

  // 动态成员输入框
  function addPresetInput() {
    setPresetInputs((prev) => [...prev, ""]);
  }
  function removePresetInput(index: number) {
    setPresetInputs((prev) => prev.filter((_, i) => i !== index));
  }
  function updatePresetInput(index: number, value: string) {
    setPresetInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  // 创建项目
  async function handleCreateProject() {
    setError(null);
    if (!isRegistered) { setError("请先登录或注册。"); return; }
    const t = createTitle.trim();
    if (t.length < 2) { setError("请填写项目名称（至少 2 个字）"); return; }
    if (!createDeadline) {
      setError("请在日历中选择截止时间并点击「确定」");
      return;
    }
    const on = createOwnerName.trim();
    if (!on) { setError("请填写你在项目中的显示昵称"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          deadline: new Date(createDeadline).toISOString(),
          ownerName: on,
          memberNames: presetInputs.map((n) => n.trim()).filter(Boolean)
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "创建失败"); return; }

      // 关闭表单并刷新
      setShowCreateForm(false);
      setCreateTitle("");
      setCreateDeadline("");
      setCreateOwnerName("");
      setPresetInputs([""]);
      router.push(`/project/${data.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  // 加入项目
  async function handleJoinProject() {
    setError(null);
    if (!isRegistered) { setError("请先登录或注册后再加入项目。"); return; }
    const code = joinInviteCode.trim();
    if (!code) { setError("请填写邀请码"); return; }

    setSubmitting(true);
    try {
      // S3: 如果有 presetId，走联合激活接口
      if (joinPresetId) {
        const res = await fetch("/api/join-by-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: code, presetId: joinPresetId })
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "加入失败"); return; }
        setShowJoinForm(false);
        setJoinInviteCode("");
        setJoinPresetId(null);
        router.push(`/project/${data.projectId}`);
        return;
      }

      // 普通邀请码加入
      const res = await fetch("/api/projects/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "加入失败"); return; }

      setShowJoinForm(false);
      setJoinInviteCode("");
      router.push(`/project/${data.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入失败");
    } finally {
      setSubmitting(false);
    }
  }

  function enterProject(id: string) {
    router.push(`/project/${id}`);
  }

  // 项目重命名
  async function handleRenameProject(projectId: string, newTitle: string) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "重命名失败");
    }
    // 刷新项目列表
    setMyProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, title: newTitle } : p))
    );
  }

  // 删除项目
  async function handleDeleteProject(projectId: string) {
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "删除失败");
    }
    // 刷新项目列表
    setMyProjects((prev) => prev.filter((p) => p.id !== projectId));
  }

  // 拖拽排序
  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newProjects = [...sortedOtherProjects];
    const draggedItem = newProjects[draggedIndex];
    newProjects.splice(draggedIndex, 1);
    newProjects.splice(index, 0, draggedItem);

    // 更新排序
    const updatedProjects = myProjects.map((p) => {
      if (p.title === "我的任务草稿") return p;
      const newIndex = newProjects.findIndex((np) => np.id === p.id);
      return newIndex >= 0 ? newProjects[newIndex] : p;
    });
    setMyProjects(updatedProjects);
    setDraggedIndex(index);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    // 可选：保存排序到服务器
    // saveProjectOrder(sortedOtherProjects.map(p => p.id));
  }

  // 识别草稿空间和其他项目
  const draftSpace = myProjects.find((p) => p.title === "我的任务草稿");
  const otherProjects = myProjects.filter((p) => p.title !== "我的任务草稿");

  // 其他项目按角色和更新时间排序
  const sortedOtherProjects = [...otherProjects].sort((a, b) => {
    if (a.role === "OWNER" && b.role !== "OWNER") return -1;
    if (a.role !== "OWNER" && b.role === "OWNER") return 1;
    return 0;
  });

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className={ui.shell}>

        {/* 顶部标题区 */}
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Fusion Space</h1>
        </header>

        {/* 个人中心 */}
        {canUseApp && sessionUser ? (
          <div className="mb-6">
            <PersonalCenter
              email={sessionUser.email || ""}
              globalNickname={sessionUser.name}
              onNicknameUpdate={handleUpdateNickname}
            />
          </div>
        ) : null}

        {/* 未登录提示 */}
        {!authReady ? (
          <p className="mt-14 text-center text-sm text-neutral-400">正在确认登录状态…</p>
        ) : authReady && !canUseApp ? (
          <div className={ui.card}>
            <p className="text-sm text-neutral-500 mb-4">
              登录后可开启任务空间或加入朋友的团队项目。
            </p>
            {joinInviteCode ? (
              <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                检测到邀请码「{joinInviteCode}」，登录后可直接加入{joinPresetId ? "并代入预设昵称" : ""}。
              </p>
            ) : null}
            <div className="flex gap-3">
              <Link
                href={`/login?invite=${encodeURIComponent(joinInviteCode)}${joinPresetId ? `&preset=${encodeURIComponent(joinPresetId)}` : ""}`}
                className={`${ui.btnGhostDark} flex-1 justify-center`}
              >
                登录
              </Link>
              <Link
                href={`/register?invite=${encodeURIComponent(joinInviteCode)}${joinPresetId ? `&preset=${encodeURIComponent(joinPresetId)}` : ""}`}
                className={`${ui.btnGhost} flex-1 justify-center`}
              >
                注册
              </Link>
            </div>
          </div>
        ) : null}

        {/* 已登录：显示项目列表 */}
        {canUseApp ? (
          <>
            {/* 错误提示 */}
            {error ? (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            {/* 项目列表 */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                  我的项目
                </h2>
                {sessionUser && (
                  <button
                    type="button"
                    onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => window.location.reload())}
                    className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
                  >
                    退出登录
                  </button>
                )}
              </div>

              {projectsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 草稿空间（置顶） */}
                  {draftSpace && (
                    <DraftSpaceCard
                      projectId={draftSpace.id}
                      inviteCode={draftSpace.inviteCode}
                      onEnter={enterProject}
                      onRename={(newTitle) => handleRenameProject(draftSpace.id, newTitle)}
                      onDelete={() => handleDeleteProject(draftSpace.id)}
                    />
                  )}

                  {/* 其他项目 */}
                  {sortedOtherProjects.length > 0 && (
                    <div className="space-y-2">
                      {sortedOtherProjects.map((p, index) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          onEnter={enterProject}
                          onRename={handleRenameProject}
                          onDelete={handleDeleteProject}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          isDragging={draggedIndex === index}
                        />
                      ))}
                    </div>
                  )}

                  {/* 空状态 */}
                  {!draftSpace && sortedOtherProjects.length === 0 && (
                    <div className={ui.card}>
                      <EmptyDraftSpace />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 底部操作按钮 */}
            <div className="fixed bottom-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm border-t border-neutral-200/80 px-5 py-3 sm:px-6">
              <div className="mx-auto flex max-w-3xl gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className={`${ui.btnPrimary} flex items-center justify-center gap-2 flex-1`}
                >
                  <Plus className="h-4 w-4" />
                  开启新任务空间
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinForm(true)}
                  className={`${ui.btnGhost} flex-1 justify-center`}
                >
                  <Users className="h-4 w-4" />
                  加入团队项目
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* 新建项目弹窗 */}
      {showCreateForm ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl sm:shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">开启新任务空间</h2>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={ui.label}>空间名称</label>
                <input
                  className={ui.field}
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="例如：毕业设计协作"
                  maxLength={60}
                />
              </div>

              <div>
                <label className={ui.label}>截止时间</label>
                <DateTimeConfirmField
                  value={createDeadline}
                  onChange={setCreateDeadline}
                  placeholder="点击选择日期与时间"
                  min={new Date()}
                />
                <p className="mt-1.5 text-xs text-neutral-400">在弹出面板中选日期、时间后点击「确定」。</p>
              </div>

              <div>
                <label className={ui.label}>你在项目中的显示昵称</label>
                <input
                  className={ui.field}
                  value={createOwnerName}
                  onChange={(e) => setCreateOwnerName(e.target.value)}
                  placeholder="例如：张三"
                  maxLength={20}
                />
              </div>

              {/* 预设成员 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={ui.label + " mb-0"}>预邀请成员（可选）</label>
                  <button
                    type="button"
                    onClick={addPresetInput}
                    className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {presetInputs.map((name, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className={ui.field}
                        value={name}
                        onChange={(e) => updatePresetInput(i, e.target.value)}
                        placeholder={`成员 ${i + 1} 昵称`}
                        maxLength={40}
                      />
                      {presetInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePresetInput(i)}
                          className="shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-neutral-400">
                  成员入驻后即可加入空间，可随时增减。
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className={`${ui.btnGhost} flex-1 justify-center`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={submitting || !createDeadline}
                className={`${ui.btnPrimary} flex-1 flex items-center justify-center gap-2`}
              >
                {submitting ? "创建中…" : "创建空间"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 加入项目弹窗 */}
      {showJoinForm ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowJoinForm(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl sm:shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">加入团队项目</h2>
              <button
                type="button"
                onClick={() => setShowJoinForm(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className={ui.label}>输入朋友分享的邀请码</label>
              <div className="flex gap-2">
                <input
                  className={`${ui.field} min-w-0 flex-1 font-mono text-sm`}
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value)}
                  placeholder="FUSION-XXXX"
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  title="扫描邀请二维码"
                  onClick={() => setInviteScanOpen(true)}
                  className={`${ui.btnGhost} shrink-0 gap-1.5 px-3`}
                >
                  <Camera className="h-4 w-4" />
                  扫码
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                向组长索取以 FUSION- 开头的邀请码，或请对方分享含邀请码的链接。
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowJoinForm(false)}
                className={`${ui.btnGhost} flex-1 justify-center`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleJoinProject}
                disabled={submitting}
                className={`${ui.btnPrimary} flex-1 flex items-center justify-center gap-2`}
              >
                {submitting ? "加入中…" : "加入项目"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 二维码扫描 */}
      <InviteQrScanner
        open={inviteScanOpen}
        onClose={() => setInviteScanOpen(false)}
        onDecoded={(code, presetId) => {
          setJoinInviteCode(code);
          if (presetId) setJoinPresetId(presetId);
          setInviteScanOpen(false);
        }}
      />
    </main>
  );
}
