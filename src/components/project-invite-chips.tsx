"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  inviteCode: string;
  /** 预设 ID（用于生成带预设身份的邀请链接） */
  presetId?: string;
};

type HoverCard = "code" | "link" | "qr";

/** 紧凑型邀请入口：三个胶囊按钮，hover 时展开信息卡片 */
export function ProjectInviteChips({ inviteCode, presetId }: Props) {
  const [hovering, setHovering] = useState<HoverCard | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 直接从 window 计算 origin，避免 useEffect 时序问题
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const inviteLink =
    origin && inviteCode
      ? `${origin.replace(/\/$/, "")}/?invite=${encodeURIComponent(inviteCode.trim())}${presetId ? `&preset=${encodeURIComponent(presetId)}` : ""}`
      : "";

  // 预生成二维码
  useEffect(() => {
    if (!inviteLink || qrDataUrl) return;

    let cancelled = false;
    void QRCode.toDataURL(inviteLink, {
      width: 160,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" }
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [inviteLink, qrDataUrl]);

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

  const items: { key: HoverCard; label: string; icon: string }[] = [
    { key: "code", label: "邀请码", icon: "#" },
    { key: "link", label: "链接", icon: "↗" },
    { key: "qr", label: "二维码", icon: "▣" }
  ];

  return (
    <div className="relative">
      {/* 三个入口按钮 */}
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onMouseEnter={() => {
              setHovering(item.key);
            }}
            onClick={() => {
              // 点击即复制（快速操作）
              if (item.key === "code") void copy("code", inviteCode);
              if (item.key === "link") void copy("link", inviteLink);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              hovering === item.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="mr-1" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Hover 卡片（onMouseLeave 在卡片本身上，防止鼠标移到卡片时外层误触） */}
      {hovering ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          onMouseLeave={() => {
            setHovering(null);
          }}
        >
          {/* 邀请码卡片 */}
          {hovering === "code" && (
            <div className="min-w-0">
              <div className="mb-2 truncate font-mono text-base font-bold tracking-widest text-slate-900">
                {inviteCode}
              </div>
              <button
                type="button"
                onClick={() => copy("code", inviteCode)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {copiedKey === "code" ? "已复制" : "复制邀请码"}
              </button>
            </div>
          )}

          {/* 链接卡片 */}
          {hovering === "link" && (
            <div className="min-w-0">
              <div className="mb-2 max-w-[220px] break-all text-xs font-mono text-slate-600">
                {inviteLink || "—"}
              </div>
              <button
                type="button"
                onClick={() => copy("link", inviteLink)}
                disabled={!inviteLink}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
              >
                {copiedKey === "link" ? "已复制" : "复制邀请链接"}
              </button>
            </div>
          )}

          {/* 二维码卡片 */}
          {hovering === "qr" && (
            <div className="flex flex-col items-center gap-2">
              <div className="mb-1 text-center text-xs text-slate-500">
                扫码加入项目{presetId ? "并代入预设昵称" : ""}
              </div>
              <div className="flex justify-center rounded-lg border border-slate-100 bg-slate-50 p-2">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    width={160}
                    height={160}
                    alt="邀请二维码"
                    unoptimized
                    className="h-[160px] w-[160px]"
                  />
                ) : (
                  <div className="flex h-[160px] w-[160px] items-center justify-center text-xs text-slate-400">
                    生成中…
                  </div>
                )}
              </div>
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => copy("link", inviteLink)}
                  disabled={!inviteLink}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  复制链接
                </button>
                <button
                  type="button"
                  onClick={downloadQr}
                  disabled={!qrDataUrl}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-800 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  保存图片
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
