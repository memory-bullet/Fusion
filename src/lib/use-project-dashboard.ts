"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData, DashboardDocument } from "@/lib/types";

function normalizeDocument(raw: unknown): DashboardDocument {
  const d = raw as Record<string, unknown>;
  const author = d.author as { id: string; name: string };
  return {
    id: String(d.id),
    title: String(d.title ?? ""),
    content: String(d.content ?? ""),
    description: typeof d.description === "string" ? d.description : "",
    originalFileName: d.originalFileName != null ? String(d.originalFileName) : null,
    mimeType: d.mimeType != null ? String(d.mimeType) : null,
    fileSize: typeof d.fileSize === "number" ? d.fileSize : null,
    storageKey: d.storageKey != null ? String(d.storageKey) : null,
    fileHash: d.fileHash != null ? String(d.fileHash) : null,
    reviewStatus:
      d.reviewStatus === "PENDING" || d.reviewStatus === "REJECTED" ? d.reviewStatus : "APPROVED",
    reviewComment: typeof d.reviewComment === "string" ? d.reviewComment : "",
    reviewedBy: d.reviewedBy != null ? String(d.reviewedBy) : null,
    reviewedAt: d.reviewedAt != null ? String(d.reviewedAt) : null,
    pointsAwarded: typeof d.pointsAwarded === "number" ? d.pointsAwarded : 0,
    createdAt: String(d.createdAt ?? ""),
    updatedAt: String(d.updatedAt ?? ""),
    author
  };
}

type Options = {
  /** 为 true 时不轮询，避免编辑文档时被刷新覆盖 */
  pausePolling?: boolean;
};

export function useProjectDashboard(projectId: string, options?: Options) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pausePolling = options?.pausePolling ?? false;

  const fetchDashboard = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/dashboard`, {
      cache: "no-store",
      credentials: "include"
    });
    const payload = await res.json();

    if (!res.ok) {
      setError(payload.error || "Failed to load dashboard");
      return;
    }

    const raw = payload as Record<string, unknown>;
    const normalized: DashboardData = {
      ...(payload as DashboardData),
      isOwner: typeof raw.isOwner === "boolean" ? raw.isOwner : Boolean(raw.isOwner),
      members: Array.isArray(raw.members) ? (raw.members as DashboardData["members"]) : [],
      documents: Array.isArray(payload.documents) ? payload.documents.map(normalizeDocument) : [],
      me: payload.me ?? null
    };

    setData(normalized);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (pausePolling) return undefined;
    const timer = window.setInterval(fetchDashboard, 15000);
    return () => window.clearInterval(timer);
  }, [fetchDashboard, pausePolling]);

  return {
    data,
    error,
    refresh: fetchDashboard
  };
}
