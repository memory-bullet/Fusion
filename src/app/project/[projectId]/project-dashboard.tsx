"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FilePlus2, FileText, FolderOpen, PencilLine, Trash2, Users2 } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ProjectHero } from "@/components/project-hero";
import { useProjectDashboard } from "@/lib/use-project-dashboard";

type Props = {
  projectId: string;
};

type ProjectDoc = {
  id: string;
  title: string;
  author: string;
  content: string;
};

function buildInitialDocs(
  title: string,
  summary: string,
  members: Array<{ name: string }>,
  tasks: Array<{ title: string; assignee: { name: string } | null; workloadPoints: number }>
): ProjectDoc[] {
  const owner = members[0]?.name ?? "队员";
  return [
    {
      id: "overview-doc",
      title: "项目概述",
      author: owner,
      content: `${title}\n\n项目概述：\n${summary || "暂无共享摘要。"}`
    },
    {
      id: "task-plan-doc",
      title: "任务拆解",
      author: members[1]?.name ?? owner,
      content:
        tasks.length > 0
          ? tasks.map((task, index) => `${index + 1}. ${task.title}｜负责人：${task.assignee?.name ?? "待分配"}｜工作量：${task.workloadPoints}`).join("\n")
          : "当前还没有已生成任务，可以先在项目管理页或 AI 面板中补充内容。"
    },
    {
      id: "member-notes-doc",
      title: "成员协作记录",
      author: members[2]?.name ?? owner,
      content: members.map((member, index) => `${index + 1}. ${member.name}：待补充本周进展`).join("\n")
    }
  ];
}

export function ProjectDashboard({ projectId }: Props) {
  const { data, error } = useProjectDashboard(projectId);
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!data || docs.length > 0) return;
    const initialDocs = buildInitialDocs(data.project.title, data.project.contextSummary, data.members, data.tasks);
    setDocs(initialDocs);
    setSelectedDocId(initialDocs[0]?.id ?? null);
  }, [data, docs.length]);

  const selectedDoc = useMemo(() => {
    if (!docs.length) return null;
    return docs.find((doc) => doc.id === selectedDocId) ?? docs[0];
  }, [docs, selectedDocId]);

  const contributionRanking = useMemo(
    () => [...(data?.members ?? [])].sort((a, b) => b.accumulatedPoints - a.accumulatedPoints),
    [data?.members]
  );

  const files = useMemo(() => {
    return docs.map((doc, index) => ({
      id: `file-${doc.id}`,
      name: `${doc.title}.${index === 0 ? "md" : index === 1 ? "docx" : "pdf"}`,
      owner: doc.author
    }));
  }, [docs]);

  function addDocument() {
    const next = docs.length + 1;
    const author = data?.me.name ?? "我";
    const doc: ProjectDoc = {
      id: `doc-${Date.now()}`,
      title: `新文档 ${next}`,
      author,
      content: "请在这里编写具体文档内容。"
    };
    setDocs((prev) => [...prev, doc]);
    setSelectedDocId(doc.id);
  }

  function deleteDocument(id: string) {
    setDocs((prev) => {
      const next = prev.filter((doc) => doc.id !== id);
      if (selectedDocId === id) {
        setSelectedDocId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function renameDocument(id: string, title: string) {
    setDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, title } : doc)));
  }

  function updateContent(content: string) {
    if (!selectedDoc) return;
    setDocs((prev) => prev.map((doc) => (doc.id === selectedDoc.id ? { ...doc, content } : doc)));
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-8">
        <p className="text-critical">{error}</p>
      </main>
    );
  }

  if (!data) {
    return <main className="min-h-screen bg-white p-8">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <TopNav />
      <div className="shell py-6">
        <ProjectHero
          project={data.project}
          title={data.project.title}
          subtitle="左侧查看共享信息与文档资产，右侧用于显示和编辑具体文档。"
        />

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="line-card rounded-[28px] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">一、项目概述</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">共享概况</h2>
                </div>
                <Users2 className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-4 rounded-[22px] bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                <div>截止时间：{new Date(data.project.deadline).toLocaleString()}</div>
                <div>邀请码：{data.project.inviteCode}</div>
                <div className="mt-3">{data.project.contextSummary}</div>
              </div>
              <Link
                href={`/project/${projectId}/manage`}
                className="mt-4 inline-flex rounded-full border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white"
              >
                进入项目管理
              </Link>
            </section>

            <section className="line-card rounded-[28px] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">二、文档列表</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">成员文档</h2>
                </div>
                <button
                  type="button"
                  onClick={addDocument}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white"
                >
                  <FilePlus2 className="h-4 w-4" />
                  添加
                </button>
              </div>

              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`rounded-[22px] border p-4 transition ${selectedDoc?.id === doc.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}
                  >
                    <button type="button" onClick={() => setSelectedDocId(doc.id)} className="w-full text-left">
                      <div className="text-base font-semibold text-slate-900">{doc.title}</div>
                      <div className="mt-1 text-sm text-slate-500">作者：{doc.author}</div>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDocId(doc.id)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        打开
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="line-card rounded-[28px] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">三、文件列表</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">项目文件</h2>
                </div>
                <FolderOpen className="h-5 w-5 text-slate-400" />
              </div>
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-800">{file.name}</div>
                      <div className="text-xs text-slate-500">作者：{file.owner}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="line-card rounded-[28px] p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-500">四、贡献度概要</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">成员得分</h2>
                </div>
                <Link
                  href={`/project/${projectId}/analytics`}
                  className="rounded-full border border-slate-900 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white"
                >
                  查看详情
                </Link>
              </div>
              <div className="space-y-3">
                {contributionRanking.map((member, index) => (
                  <div key={member.id} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-800">{index + 1}. {member.name}</div>
                      <div className="text-sm font-semibold text-slate-900">{member.accumulatedPoints}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="line-card flex min-h-[960px] flex-col rounded-[32px] bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-8 py-6">
              <div>
                <div className="text-sm font-medium text-slate-500">工作区</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">具体文档编辑</h2>
                <p className="mt-2 text-sm text-slate-500">在这里查看和编辑当前选中的项目文档。</p>
              </div>
              {selectedDoc ? (
                <div className="rounded-[22px] bg-slate-50 px-4 py-3 text-right">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">当前文档</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{selectedDoc.title}</div>
                  <div className="text-sm text-slate-500">作者：{selectedDoc.author}</div>
                </div>
              ) : null}
            </div>

            {selectedDoc ? (
              <div className="flex flex-1 flex-col px-8 py-6">
                <div className="mb-4 flex items-center gap-3 rounded-[22px] bg-slate-50 p-4">
                  <PencilLine className="h-5 w-5 text-slate-500" />
                  <input
                    value={selectedDoc.title}
                    onChange={(event) => renameDocument(selectedDoc.id, event.target.value)}
                    className="w-full border-0 bg-transparent text-xl font-semibold tracking-tight outline-none"
                    placeholder="输入文档标题"
                  />
                </div>
                <textarea
                  value={selectedDoc.content}
                  onChange={(event) => updateContent(event.target.value)}
                  className="min-h-[720px] w-full flex-1 resize-none rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-base leading-8 text-slate-700 outline-none transition focus:border-slate-300"
                  placeholder="在这里输入文档内容..."
                />
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => deleteDocument(selectedDoc.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除当前文档
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-12 text-center text-slate-500">
                暂无文档，请先在左侧文档列表中添加一个新文档。
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
