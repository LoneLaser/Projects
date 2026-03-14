import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

// ── Types ──

export type EmailProvider = 'smtp' | 'outlook_smtp' | 'gmail_smtp';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  replyTo?: string;
}

export interface SendReportOptions {
  provider: EmailProvider;
  config: SmtpConfig;
  recipients: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  signature?: string;
  attachments: string[]; // file paths
}

// ── Provider presets ──

function getTransportConfig(provider: EmailProvider, config: SmtpConfig): nodemailer.TransportOptions {
  switch (provider) {
    case 'outlook_smtp':
      return {
        host: config.host || 'smtp.office365.com',
        port: config.port || 587,
        secure: false,
        auth: { user: config.username, pass: config.password },
        tls: { ciphers: 'SSLv3' },
      } as nodemailer.TransportOptions;

    case 'gmail_smtp':
      return {
        host: config.host || 'smtp.gmail.com',
        port: config.port || 465,
        secure: true,
        auth: { user: config.username, pass: config.password },
      } as nodemailer.TransportOptions;

    case 'smtp':
    default:
      return {
        host: config.host,
        port: config.port || 587,
        secure: config.secure ?? false,
        auth: { user: config.username, pass: config.password },
      } as nodemailer.TransportOptions;
  }
}

// ── Send report email ──

export async function sendReport(options: SendReportOptions): Promise<{ messageId: string }> {
  const { provider, config, recipients, subject, body, cc, bcc, signature, attachments } = options;

  if (!recipients.length) {
    throw new Error('No recipients specified');
  }

  const transportConfig = getTransportConfig(provider, config);
  const transporter = nodemailer.createTransport(transportConfig);

  // Build email body with optional signature
  let htmlBody = `<div>${body.replace(/\n/g, '<br/>')}</div>`;
  if (signature) {
    htmlBody += `<br/><div style="border-top:1px solid #ccc;margin-top:16px;padding-top:8px;color:#666;font-size:12px">${signature}</div>`;
  }

  // Build attachment list
  const mailAttachments = attachments
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({
      filename: path.basename(filePath),
      path: filePath,
    }));

  const mailOptions: nodemailer.SendMailOptions = {
    from: config.from || config.username,
    to: recipients.join(', '),
    cc: cc?.join(', ') || undefined,
    bcc: bcc?.join(', ') || undefined,
    replyTo: config.replyTo || undefined,
    subject,
    html: htmlBody,
    attachments: mailAttachments,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email sent: ${info.messageId} to ${recipients.join(', ')}`);

  return { messageId: info.messageId };
}

// ── Verify SMTP connection ──

export async function verifySmtpConnection(
  provider: EmailProvider,
  config: SmtpConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const transportConfig = getTransportConfig(provider, config);
    const transporter = nodemailer.createTransport(transportConfig);
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
