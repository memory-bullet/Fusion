"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ImageUp, Loader2 } from "lucide-react";
import { parseInviteFromScan } from "@/lib/invite-qr-parse";

type ScanTab = "camera" | "file";

type Props = {
  open: boolean;
  onClose: () => void;
  onDecoded: (inviteCode: string, presetId?: string | null) => void;
};

function buildQrReader() {
  const hints = new Map<DecodeHintType, BarcodeFormat[]>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  return new BrowserMultiFormatReader(hints);
}

export function InviteQrScanner({ open, onClose, onDecoded }: Props) {
  const dialogId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ScanTab>("camera");
  const [error, setError] = useState<string | null>(null);
  const [fileDecoding, setFileDecoding] = useState(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const onCloseRef = useRef(onClose);
  onDecodedRef.current = onDecoded;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) setError(null);
    else setTab("camera");
  }, [open]);

  useLayoutEffect(() => {
    if (!open || tab !== "camera") return;

    const video = videoRef.current;
    if (!video) return;

    setError(null);
    let cancelled = false;
    const reader = buildQrReader();

    void (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result, _exc, c) => {
          if (cancelled || !result) return;
          const code = parseInviteFromScan(result.getText());
          if (code.inviteCode) {
            c.stop();
            controlsRef.current = null;
            onDecodedRef.current(code.inviteCode, code.presetId);
            onCloseRef.current();
          }
        });
        if (!cancelled) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch {
        if (!cancelled) {
          setError("无法打开摄像头。可切换到「上传图片」识别保存的二维码截图。");
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, tab]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件（如 PNG、JPG）。");
      return;
    }

    setError(null);
    setFileDecoding(true);
    const url = URL.createObjectURL(file);
    try {
      const reader = buildQrReader();
      const result = await reader.decodeFromImageUrl(url);
      const code = parseInviteFromScan(result.getText());
      if (code.inviteCode) {
        onDecodedRef.current(code.inviteCode, code.presetId);
        onCloseRef.current();
      } else {
        setError("图中未识别到有效的邀请链接或邀请码。");
      }
    } catch {
      setError("未能识别二维码。请尽量使用清晰、完整的截图，或换用摄像头扫描。");
    } finally {
      URL.revokeObjectURL(url);
      setFileDecoding(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`${dialogId}-title`} className="text-base font-semibold text-neutral-900">
          识别邀请二维码
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          使用摄像头实时扫描，或上传手机相册/截图中的二维码图片。识别成功后将自动填入邀请码。
        </p>

        <div className="mt-4 flex gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab("camera");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === "camera" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            摄像头
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("file");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === "file" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            上传图片
          </button>
        </div>

        {tab === "camera" ? (
          <div className="relative mt-4 overflow-hidden rounded-xl bg-neutral-900">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(e) => void onFileChange(e)}
            />
            <button
              type="button"
              disabled={fileDecoding}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fileDecoding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImageUp className="h-4 w-4" aria-hidden />}
              {fileDecoding ? "识别中…" : "选择二维码图片"}
            </button>
            <p className="mt-2 text-xs text-neutral-500">支持相册截图、保存的邀请码图片等</p>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
