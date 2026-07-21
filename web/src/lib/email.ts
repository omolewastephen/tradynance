// NB: deliberately NOT `import "server-only"`. This module is imported by src/lib/auth.ts, which
// `prisma db seed` (tsx) also imports — server-only throws outside Next's bundler and broke the
// seed. It's server-safe regardless: nodemailer is Node-only, so a client bundle would fail loudly.
import nodemailer, { type Transporter } from "nodemailer";

// Transactional email. Three transports, picked by which credentials are present, in order:
//   1. SMTP  — if SMTP_HOST is set (Zoho Mail / ZeptoMail / any SMTP provider) via nodemailer.
//   2. Resend — else if RESEND_API_KEY is set, via Resend's HTTP API (no SDK, just fetch).
//   3. Console — else logs to the console, so the reset / verification / withdrawal-OTP flows
//      stay end-to-end testable in dev. Production-ready, inert until you supply a credential.
//
// Zoho: set SMTP_HOST=smtp.zoho.com, SMTP_PORT=465, SMTP_SECURE=true, SMTP_USER=<your zoho
// address>, SMTP_PASS=<app-specific password>, EMAIL_FROM="Tradynance <you@yourdomain.com>".
// (Zoho requires an app-specific password when 2FA is on, and a verified From domain.) See
// .env.example.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Lazy singleton SMTP transporter — created once when SMTP_HOST is present. Serverless-safe
// (a short connect→send→close per invocation is fine for low-volume transactional mail).
let smtpTransport: Transporter | null | undefined;
function getSmtpTransport(): Transporter | null {
  if (smtpTransport !== undefined) return smtpTransport;
  const host = process.env.SMTP_HOST;
  if (!host) {
    smtpTransport = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    // 465 = implicit TLS; 587 = STARTTLS. Honour SMTP_SECURE if set, else infer from the port.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return smtpTransport;
}

export async function sendEmail(
  email: EmailInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Tradynance <onboarding@resend.dev>";
  const text = email.text ?? stripHtml(email.html);

  // 1. HTTP API first. This ordering is deliberate: serverless hosts (Netlify/Vercel, i.e. AWS
  //    Lambda) block outbound SMTP on 465/587, so a perfectly valid SMTP config silently fails in
  //    production while working fine locally. An HTTPS send always works. Verified the hard way.
  if (apiKey) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, html: email.html, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[email] HTTP send failed", res.status, body);
        return { ok: false, error: `Resend ${res.status}` };
      }
      const data = (await res.json()) as { id?: string };
      return { ok: true, id: data.id };
    } catch (err) {
      console.error("[email] HTTP send error", (err as Error).message);
      return { ok: false, error: (err as Error).message };
    }
  }

  // 2. SMTP fallback — fine on a VPS/Docker/Railway (long-lived Node), not on serverless.
  const transport = getSmtpTransport();
  if (transport) {
    try {
      const info = await transport.sendMail({
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text,
      });
      return { ok: true, id: info.messageId };
    } catch (err) {
      console.error("[email] SMTP send error", (err as Error).message);
      return { ok: false, error: (err as Error).message };
    }
  }

  // 3. No transport configured — log so dev flows stay testable.
  console.log(`[email] (no RESEND_API_KEY / SMTP_HOST) → ${email.to} | ${email.subject}`);
  console.log(`[email] ${text}`);
  return { ok: true };
}

// ── Branded template (inline styles — email clients ignore <style>/external CSS) ──────────────

function layout(opts: { heading: string; body: string; cta?: { label: string; url: string }; footer?: string }): string {
  const button = opts.cta
    ? `<a href="${opts.cta.url}" style="display:inline-block;background:#18C964;color:#04120a;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;font-size:15px">${opts.cta.label}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#08090C;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:700;color:#18C964;letter-spacing:-.02em;margin-bottom:24px">Tradynance</div>
    <div style="background:#111827;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:19px;color:#e6e9ef;font-weight:600">${opts.heading}</h1>
      <div style="color:#8a93a6;font-size:14px;line-height:1.6">${opts.body}</div>
      ${button ? `<div style="margin-top:22px">${button}</div>` : ""}
      ${opts.footer ? `<div style="margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);color:#5b6472;font-size:12px;line-height:1.5">${opts.footer}</div>` : ""}
    </div>
    <div style="color:#5b6472;font-size:11px;text-align:center;margin-top:20px">
      You received this because an action was taken on your Tradynance account. If this wasn't you, secure your account immediately.
    </div>
  </div></body></html>`;
}

function antiPhishingLine(code?: string | null): string {
  return code
    ? `<div style="margin-top:16px;color:#5b6472;font-size:12px">Anti-phishing code: <span style="color:#e6e9ef;font-weight:600;font-family:monospace">${code}</span> — genuine Tradynance emails always show this.</div>`
    : "";
}

export function sendPasswordResetEmail(to: string, url: string, antiPhishing?: string | null) {
  return sendEmail({
    to,
    subject: "Reset your Tradynance password",
    html: layout({
      heading: "Reset your password",
      body: "We received a request to reset your password. This link expires shortly. If you didn't ask for this, you can safely ignore this email.",
      cta: { label: "Reset password", url },
      footer: `Or paste this link into your browser:<br><span style="color:#2563EB;word-break:break-all">${url}</span>${antiPhishingLine(antiPhishing)}`,
    }),
  });
}

export function sendVerificationEmail(to: string, url: string) {
  return sendEmail({
    to,
    subject: "Verify your Tradynance email",
    html: layout({
      heading: "Confirm your email",
      body: "Welcome to Tradynance. Confirm your email address to activate your account.",
      cta: { label: "Verify email", url },
      footer: `Or paste this link into your browser:<br><span style="color:#2563EB;word-break:break-all">${url}</span>`,
    }),
  });
}

export function sendWithdrawalOtpEmail(to: string, code: string, antiPhishing?: string | null) {
  return sendEmail({
    to,
    subject: "Your Tradynance withdrawal code",
    html: layout({
      heading: "Confirm your withdrawal",
      body: `Use this code to confirm your withdrawal request. It expires in 10 minutes and should never be shared with anyone.<div style="margin-top:20px;font-size:30px;font-weight:700;letter-spacing:.3em;color:#18C964;font-family:monospace">${code}</div>`,
      footer: `If you didn't request a withdrawal, someone may have access to your account — reset your password and review your sessions now.${antiPhishingLine(antiPhishing)}`,
    }),
  });
}
