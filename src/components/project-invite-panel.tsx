"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  inviteCode: string;
  /** 预设 ID，用于生成带 presetId 的邀请链接 */
  presetId?: string;
};

type Tab = "code" | "link" | "qr";

export function ProjectInvitePanel({ inviteCode, presetId }: Props) {
  const [tab, setTab] = useState<Tab>("code");
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const inviteLink = origin
    ? `${origin}/?invite=${encodeURIComponent(inviteCode.trim())}${presetId ? `&preset=${encodeURIComponent(presetId)}` : ""}`
    : "";

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  // Generate QR code when qr tab is active
  useEffect(() => {
    if (tab !== "qr" || !inviteLink) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(inviteLink, {
      width: 220,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" }
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, inviteLink]);

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  const downloadQr = useCallback(() => {
    if (!qrDataUrl) return;
    const safe = inviteCode.trim().replace(/[^\w.-]+/g, "_") || "invite";
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `Fusion邀请二维码-${safe}.png`;
    a.rel = "noopener";
    a.click();
  }, [qrDataUrl, inviteCode]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "code", label: "邀请码" },
    { key: "link", label: "网页链接" },
    { key: "qr", label: "二维码" }
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-5 pb-0">
        <div>
          <div className="text-sm font-medium text-slate-500">邀请协作者</div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">邀请加入</h3>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                tab === t.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* 邀请码 Tab */}
        {tab === "code" && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-8 py-4">
              <span className="font-mono text-3xl font-bold tracking-widest text-slate-900">
                {inviteCode}
              </span>
            </div>
            <p className="text-center text-sm text-slate-500">
              将邀请码分享给对方，对方在首页输入即可加入项目
            </p>
            <button
              type="button"
              onClick={() => copy("code", inviteCode)}
              className="rounded-full border border-slate-900 bg-slate-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {copiedKey === "code" ? "已复制" : "复制邀请码"}
            </button>
          </div>
        )}

        {/* 网页链接 Tab */}
        {tab === "link" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">网页邀请链接</div>
              <div className="mt-1 break-all font-mono text-sm text-slate-700">{inviteLink || "加载中…"}</div>
            </div>
            <p className="text-sm text-slate-500">
              复制链接发送给朋友，对方打开即自动带邀请码，可直接加入项目
              {presetId ? "，并代入预设昵称" : ""}
            </p>
            <button
              type="button"
              onClick={() => copy("link", inviteLink)}
              disabled={!inviteLink}
              className="rounded-full border border-slate-900 bg-slate-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {copiedKey === "link" ? "已复制链接" : "一键复制链接"}
            </button>
          </div>
        )}

        {/* 二维码 Tab */}
        {tab === "qr" && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  width={220}
                  height={220}
                  alt="邀请二维码"
                  unoptimized
                  className="h-[220px] w-[220px]"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-slate-400">
                  生成中…
                </div>
              )}
            </div>
            <p className="text-center text-sm text-slate-500">
              扫码加入项目{presetId ? "并代入预设昵称" : ""}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => copy("link", inviteLink)}
                disabled={!inviteLink}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                复制链接
              </button>
              <button
                type="button"
                onClick={downloadQr}
                disabled={!qrDataUrl}
                className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                下载二维码
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
