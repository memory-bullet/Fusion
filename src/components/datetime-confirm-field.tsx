"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { format } from "date-fns";
import "react-day-picker/style.css";

/** 浏览器原生 datetime-local 无法用 JS 在日历浮层中加「确定」；本组件用日历 + 时间 + 底部按钮替代 */

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDatetimeLocal(isoLike: string): Date | null {
  if (!isoLike.trim()) return null;
  const d = new Date(isoLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDatetimeLocalString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export type DateTimeConfirmFieldProps = {
  /** 形如 YYYY-MM-DDTHH:mm（local），空表示未选 */
  value: string;
  onChange: (nextLocal: string) => void;
  placeholder?: string;
  min?: Date;
  max?: Date;
  /** 触发按钮区域 class（外观与表单 input 一致时可传入） */
  triggerClassName?: string;
};

export function DateTimeConfirmField({
  value,
  onChange,
  placeholder = "请选择日期与时间",
  min,
  max,
  triggerClassName = ""
}: DateTimeConfirmFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const [calendarDay, setCalendarDay] = useState<Date>(() => stripTime(new Date()));
  const [timeHm, setTimeHm] = useState("09:00");

  const parsed = parseDatetimeLocal(value);

  useEffect(() => {
    if (!open) return;
    const base = parseDatetimeLocal(value) ?? new Date();
    const day = stripTime(base);
    setCalendarDay(day);
    const hh = String(base.getHours()).padStart(2, "0");
    const mm = String(base.getMinutes()).padStart(2, "0");
    setTimeHm(`${hh}:${mm}`);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function handleConfirm() {
    const d = new Date(calendarDay);
    const [hhRaw, mmRaw] = timeHm.split(":");
    const hh = Number.parseInt(hhRaw ?? "0", 10);
    const mm = Number.parseInt(mmRaw ?? "0", 10);
    const hours = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 0;
    const minutes = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
    d.setHours(hours, minutes, 0, 0);

    if (min && d.getTime() < min.getTime()) {
      onChange(toDatetimeLocalString(min));
      setOpen(false);
      return;
    }
    if (max && d.getTime() > max.getTime()) {
      onChange(toDatetimeLocalString(max));
      setOpen(false);
      return;
    }

    onChange(toDatetimeLocalString(d));
    setOpen(false);
  }

  const display =
    parsed != null ? format(parsed, "yyyy/MM/dd HH:mm", { locale: zhCN }) : "";

  const disabledMatcher = (date: Date) => {
    const t = stripTime(date).getTime();
    if (min && t < stripTime(min).getTime()) return true;
    if (max && t > stripTime(max).getTime()) return true;
    return false;
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border-0 bg-neutral-50 px-4 py-3 text-left text-sm text-neutral-900 ring-1 ring-inset ring-neutral-200 transition hover:bg-neutral-100/80 focus:outline-none focus:ring-2 focus:ring-neutral-900 ${triggerClassName}`}
      >
        <span className={display ? "text-neutral-900" : "text-neutral-400"}>
          {display || placeholder}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-[60] mt-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl ring-1 ring-black/5">
          <DayPicker
            mode="single"
            locale={zhCN}
            selected={calendarDay}
            onSelect={(d) => {
              if (d) setCalendarDay(stripTime(d));
            }}
            disabled={disabledMatcher}
            captionLayout="dropdown"
            fromYear={min ? min.getFullYear() : 1970}
            toYear={max ? max.getFullYear() : new Date().getFullYear() + 10}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <span className="text-xs font-medium text-neutral-500">时间</span>
            <input
              type="time"
              step={60}
              value={timeHm}
              onChange={(e) => setTimeHm(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-900/20"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2 border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              确定
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
