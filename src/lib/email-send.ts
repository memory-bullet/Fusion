import nodemailer from "nodemailer";

export type EmailSendOutcome =
  | { status: "SENT" }
  | { status: "SKIPPED_NO_PROVIDER"; reason: string }
  | { status: "FAILED"; error: string };

/**
 * 事务邮件发送：优先 Resend HTTP API，其次 SMTP（nodemailer）。
 * 未配置任何提供商时返回 SKIPPED，不抛错，便于本地与演示环境。
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailSendOutcome> {
  const { to, subject, text } = opts;
  const from = process.env.EMAIL_FROM?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (resendKey && from) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text
        })
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        return { status: "FAILED", error: payload.message ?? `Resend HTTP ${res.status}` };
      }
      return { status: "SENT" };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "Resend request failed" };
    }
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (host && from) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number.isFinite(port) ? port : 587,
        secure: process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
        auth: user && pass ? { user, pass } : undefined
      });
      await transporter.sendMail({ from, to, subject, text });
      return { status: "SENT" };
    } catch (e) {
      return { status: "FAILED", error: e instanceof Error ? e.message : "SMTP send failed" };
    }
  }

  return {
    status: "SKIPPED_NO_PROVIDER",
    reason: "未配置 RESEND_API_KEY+EMAIL_FROM 或 SMTP_HOST+EMAIL_FROM"
  };
}
