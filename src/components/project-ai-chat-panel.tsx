"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, SendHorizontal, X } from "lucide-react";

type ChatRow = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  user: { id: string; name: string } | null;
};

type Props = {
  projectId: string;
  /** 访客为 true 时不展示 */
  disabled?: boolean;
  currentUserName?: string;
};

export function ProjectAiChatPanel({ projectId, disabled, currentUserName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const loadMessages = useCallback(async () => {
    setLoadingList(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "加载对话失败");
      }
      const list = Array.isArray(data.messages) ? data.messages : [];
      setMessages(
        list.map((m: ChatRow) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          user: m.user ?? null
        }))
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingList(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && !disabled) {
      void loadMessages();
    }
  }, [open, disabled, loadMessages]);

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [open, messages, scrollToBottom]);

  async function onSend() {
    const text = input.trim();
    if (!text || sending || disabled) return;

    setSendError(null);
    setInput("");
    const tempUserId = `local-${Date.now()}`;
    const optimisticUser: ChatRow = {
      id: tempUserId,
      role: "USER",
      content: text,
      createdAt: new Date().toISOString(),
      user: currentUserName ? { id: "me", name: currentUserName } : null
    };
    const assistantId = `assistant-${Date.now()}`;
    const optimisticAssistant: ChatRow = {
      id: assistantId,
      role: "ASSISTANT",
      content: "",
      createdAt: new Date().toISOString(),
      user: null
    };

    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);
    setSending(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text })
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : `请求失败（${res.status}）`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }

      await loadMessages();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "发送失败";
      setSendError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== assistantId));
      setInput(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  if (disabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      {open ? (
        <div className="pointer-events-auto flex max-h-[min(32rem,calc(100vh-5rem))] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.12)] sm:w-[26rem]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">项目 AI 助手</div>
              <div className="text-[11px] text-slate-500">共享上下文 · 全员可见同一会话</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {loadingList ? (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : loadError ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{loadError}</p>
            ) : messages.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                提问将自动带上当前项目的任务、成员、作业文件与进度简报。适合拆解作业、对齐分工、检查是否漏交产出物。
              </p>
            ) : null}

            {messages.map((m, idx) => {
              const streamingHere =
                sending && m.role === "ASSISTANT" && idx === messages.length - 1 && !m.content.trim();
              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-0.5 ${m.role === "USER" ? "items-end" : "items-start"}`}
                >
                  <div className="max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed">
                    {m.role === "USER" ? (
                      <div className="rounded-2xl rounded-br-md bg-slate-900 text-white">
                        <div className="px-3 py-2 whitespace-pre-wrap break-words">{m.content}</div>
                        <div className="border-t border-white/10 px-3 py-1 text-[10px] text-white/70">
                          {m.user?.name ?? "成员"}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 text-slate-800">
                        <div className="px-3 py-2 whitespace-pre-wrap break-words">
                          {streamingHere ? (
                            <span className="inline-flex items-center gap-2 text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              生成中…
                            </span>
                          ) : (
                            m.content
                          )}
                        </div>
                        <div className="border-t border-slate-100 px-3 py-1 text-[10px] text-slate-400">AI</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>

          {sendError ? (
            <div className="px-3 pb-1 text-xs text-red-600">{sendError}</div>
          ) : null}

          <div className="border-t border-slate-100 p-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
              rows={2}
              maxLength={8000}
              placeholder="描述问题，例如：根据当前任务分工，下周前谁该交付什么？"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void loadMessages()}
                disabled={sending || loadingList}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
              >
                刷新记录
              </button>
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sending || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                发送
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
        aria-label={open ? "收起 AI 助手" : "打开 AI 助手"}
      >
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        <span>AI助手</span>
      </button>
    </div>
  );
}
