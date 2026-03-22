import type { MailMessage } from '../mail/mailer.js';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Email {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
}

/** Plain, client-safe HTML plus a text part. All dynamic values are escaped. */
export function render(email: Email): MailMessage {
  const text = [
    email.heading,
    '',
    ...email.lines,
    ...(email.action ? ['', `${email.action.label}: ${email.action.url}`] : []),
    '',
    email.footer ?? 'ScopeFlow',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#121826">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #dfe3ea;border-radius:8px">
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-weight:600;color:#4f46e5">ScopeFlow</p>
<h1 style="margin:0 0 16px;font-size:20px">${escape(email.heading)}</h1>
${email.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${escape(l)}</p>`).join('\n')}
${
  email.action
    ? `<p style="margin:24px 0 0"><a href="${escape(email.action.url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${escape(email.action.label)}</a></p>`
    : ''
}
</td></tr></table>
<p style="color:#586174;font-size:12px;margin-top:16px">${escape(email.footer ?? 'You are receiving this because you are a member of a ScopeFlow organization.')}</p>
</td></tr></table></body></html>`;

  return { to: email.to, subject: email.subject, text, html };
}
