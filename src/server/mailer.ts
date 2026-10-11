import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp) throw new Error("SMTP is not configured");

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });
  return transporter;
}

export async function sendOtpEmail(to: string, code: string) {
  const transport = getTransporter();

  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: `${code} is your Cashora verification code`,
    text: `Your Cashora verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; color: #10120f;">
        <p style="font-size: 14px; color: #6b7169; margin: 0 0 8px;">Your Cashora verification code</p>
        <p style="font-size: 36px; font-weight: 700; letter-spacing: 6px; margin: 0 0 16px;">${code}</p>
        <p style="font-size: 13px; color: #6b7169; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendInviteEmail(
  to: string,
  opts: { inviterName: string; cashbookName: string; inviteLink: string; permission: "VIEW" | "EDIT" }
) {
  const transport = getTransporter();
  const { inviterName, cashbookName, inviteLink, permission } = opts;
  const permissionText = permission === "EDIT" ? "add and edit transactions" : "view transactions";

  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: `${inviterName} invited you to "${cashbookName}" on Cashora`,
    text: `${inviterName} invited you to collaborate on the "${cashbookName}" cashbook on Cashora. You'll be able to ${permissionText}. Open this link to accept: ${inviteLink}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #10120f;">
        <p style="font-size: 14px; color: #6b7169; margin: 0 0 16px;">
          <strong>${inviterName}</strong> invited you to collaborate on
        </p>
        <p style="font-size: 24px; font-weight: 700; margin: 0 0 16px;">${cashbookName}</p>
        <p style="font-size: 14px; color: #6b7169; margin: 0 0 24px;">You'll be able to ${permissionText} once you accept.</p>
        <a href="${inviteLink}" style="display: inline-block; background: #0f7a5c; color: #f6fff9; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; font-size: 14px;">
          View invitation
        </a>
        <p style="font-size: 12px; color: #6b7169; margin: 24px 0 0;">Or copy this link: ${inviteLink}</p>
      </div>
    `,
  });
}

export async function sendCashbookUpdateEmail(
  to: string[],
  opts: {
    actorName: string;
    cashbookName: string;
    changeSummary: string;
    balanceText: string;
    cashInText: string;
    cashOutText: string;
    pdfBuffer: Buffer;
    excelBuffer: Buffer;
    fileSlug: string;
  }
) {
  if (to.length === 0) return;
  const transport = getTransporter();
  const { actorName, cashbookName, changeSummary, balanceText, cashInText, cashOutText, pdfBuffer, excelBuffer, fileSlug } = opts;

  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: `${actorName} ${changeSummary} — ${cashbookName}`,
    text: `${actorName} ${changeSummary} on "${cashbookName}". Balance: ${balanceText}, Cash In: ${cashInText}, Cash Out: ${cashOutText}. The full statement is attached as PDF and Excel.`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #10120f;">
        <p style="font-size: 14px; color: #6b7169; margin: 0 0 16px;">
          <strong>${actorName}</strong> ${changeSummary} on
        </p>
        <p style="font-size: 24px; font-weight: 700; margin: 0 0 16px;">${cashbookName}</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px; background: #f0f2ee; border-radius: 8px 0 0 8px; text-align: center;">
              <p style="font-size: 10px; color: #6b7169; margin: 0 0 4px; text-transform: uppercase;">Balance</p>
              <p style="font-size: 14px; font-weight: 700; margin: 0;">${balanceText}</p>
            </td>
            <td style="padding: 8px; background: #f0f2ee; text-align: center;">
              <p style="font-size: 10px; color: #6b7169; margin: 0 0 4px; text-transform: uppercase;">Cash In</p>
              <p style="font-size: 14px; font-weight: 700; margin: 0; color: #0f9d6a;">${cashInText}</p>
            </td>
            <td style="padding: 8px; background: #f0f2ee; border-radius: 0 8px 8px 0; text-align: center;">
              <p style="font-size: 10px; color: #6b7169; margin: 0 0 4px; text-transform: uppercase;">Cash Out</p>
              <p style="font-size: 14px; font-weight: 700; margin: 0; color: #e34a4a;">${cashOutText}</p>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #6b7169; margin: 0;">The full cashbook statement is attached as PDF and Excel.</p>
      </div>
    `,
    attachments: [
      { filename: `${fileSlug}-statement.pdf`, content: pdfBuffer, contentType: "application/pdf" },
      {
        filename: `${fileSlug}-statement.xlsx`,
        content: excelBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
}
