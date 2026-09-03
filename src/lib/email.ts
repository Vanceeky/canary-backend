import nodemailer, { type Transporter } from "nodemailer";

/**
 * inviterName/projectName are user-controlled (a project's own name, or
 * whoever's inviting) — escaped before being interpolated into the HTML
 * body so neither can inject markup/links into someone else's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface InvitationEmailPayload {
  projectName: string;
  inviterName: string;
  /** Raw invite token — used to build the accept/register link, or shown as plain-text fallback. */
  token: string;
}

/**
 * Abstraction over however invite emails actually get sent, so
 * lib/invitation.ts never needs to change when the delivery mechanism
 * changes — only getEmailService()'s return value would. Same shape as
 * lib/notification.ts's NotificationService for the same reason.
 */
export interface EmailService {
  sendInvitationEmail(to: string, payload: InvitationEmailPayload): Promise<void>;
}

/**
 * Fallback used whenever SMTP isn't fully configured (e.g. local dev, or a
 * fresh deploy before SMTP_* env vars are set) — never a hard failure to
 * run the app at all. Logging exactly what *would* be sent, to whom, is
 * honest about that (per this repo's "no fake functionality presented as
 * working" guardrail) rather than silently no-op'ing or pretending delivery
 * succeeded. The raw token is also always returned in the invitation-
 * creation API response regardless, so inviting someone works today even
 * with no SMTP configured.
 */
class ConsoleEmailService implements EmailService {
  async sendInvitationEmail(to: string, payload: InvitationEmailPayload): Promise<void> {
    console.log("invitation email (SMTP not configured — logging only)", { to, ...payload });
  }
}

/**
 * Real delivery via SMTP (e.g. Gmail with an account "App Password":
 * https://myaccount.google.com/apppasswords). Constructed once and reused
 * — nodemailer transporters pool connections. Only ever selected by
 * getEmailService() when every one of SMTP_HOST/PORT/USER/PASS/FROM is
 * present; never half-configured.
 */
class SmtpEmailService implements EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: { host: string; port: number; user: string; pass: string; from: string }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // Implicit TLS on 465; STARTTLS otherwise (587/25) — nodemailer
      // negotiates STARTTLS automatically when secure is false and the
      // server supports it, which covers Gmail's smtp.gmail.com:587.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
    this.from = config.from;
  }

  async sendInvitationEmail(to: string, payload: InvitationEmailPayload): Promise<void> {
    const webAppBaseUrl = process.env.WEB_APP_BASE_URL?.trim();
    const subject = `${payload.inviterName} invited you to join "${payload.projectName}" on Canary`;
    const acceptUrl = webAppBaseUrl ? `${webAppBaseUrl.replace(/\/$/, "")}/invitations/accept?token=${payload.token}` : undefined;

    // No frontend is deployed yet to build a real accept link for — never
    // link to a page that doesn't exist. WEB_APP_BASE_URL lets this switch
    // on the moment one is, with no other code change.
    const bodyLines = acceptUrl
      ? [
          `${payload.inviterName} has invited you to join the "${payload.projectName}" project on Canary.`,
          "",
          `Accept your invitation: ${acceptUrl}`,
          "",
          "If you don't have an account yet, that link will let you create one and join automatically.",
        ]
      : [
          `${payload.inviterName} has invited you to join the "${payload.projectName}" project on Canary.`,
          "",
          "There's no web app link available yet for accepting this invitation directly. Use this invitation token when registering or accepting via the API:",
          "",
          payload.token,
          "",
          "(If you're not sure what to do with this, ask whoever invited you.)",
        ];

    const inviterName = escapeHtml(payload.inviterName);
    const projectName = escapeHtml(payload.projectName);
    const bodyHtml = acceptUrl
      ? `
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#8a8894;">
          If you don't have an account yet, that link will let you create one and join automatically.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <a href="${acceptUrl}" style="display:inline-block;background:#302B7C;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;">Accept invitation</a>
        </div>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#a8a6b3;word-break:break-all;">
          Or paste this link into your browser:<br />
          <a href="${acceptUrl}" style="color:#5854a6;">${acceptUrl}</a>
        </p>`
      : `
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#8a8894;">
          There's no web app link available yet for accepting this invitation directly. Use this
          invitation token when registering or accepting via the API:
        </p>
        <div style="background:#f4f4f7;border-radius:8px;padding:14px 16px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:13px;color:#302B7C;word-break:break-all;margin:0 0 16px;">
          ${escapeHtml(payload.token)}
        </div>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#a8a6b3;">
          (If you're not sure what to do with this, ask whoever invited you.)
        </p>`;

    const html = `
<div style="background:#f4f4f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e5ea;">
    <tr>
      <td style="padding:28px 32px;text-align:center;background:#15132b;border-radius:12px 12px 0 0;">
        <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">🐤 Canary</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1c1b20;">
          <strong>${inviterName}</strong> invited you to join <strong>&quot;${projectName}&quot;</strong> on Canary.
        </p>
        ${bodyHtml}
      </td>
    </tr>
  </table>
  <p style="max-width:480px;margin:16px auto 0;text-align:center;font-size:11px;color:#b3b1bd;">
    You're receiving this because someone invited this address to a Canary project.
  </p>
</div>`;

    await this.transporter.sendMail({ from: this.from, to, subject, text: bodyLines.join("\n"), html });
  }
}

let instance: EmailService | undefined;

export function getEmailService(): EmailService {
  if (!instance) {
    const host = process.env.SMTP_HOST?.trim();
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.SMTP_FROM?.trim();

    if (host && portRaw && user && pass && from) {
      const port = Number(portRaw);
      // A malformed SMTP_PORT falls back rather than crashing at import
      // time — consistent with "never a hard failure" above.
      instance = Number.isFinite(port) ? new SmtpEmailService({ host, port, user, pass, from }) : new ConsoleEmailService();
    } else {
      instance = new ConsoleEmailService();
    }
  }
  return instance;
}
