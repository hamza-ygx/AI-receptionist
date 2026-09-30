import { EmailClient } from "@azure/communication-email";
import { DefaultAzureCredential } from "@azure/identity";
import { optional } from "../lib/config.js";
import type { Logger } from "../lib/log.js";

let client: EmailClient | undefined;

export async function sendEmail(to: string, subject: string, text: string, html: string, log: Logger): Promise<void> {
  const endpoint = process.env.ACS_ENDPOINT;
  if (!endpoint) {
    if (optional("DEV_EMAIL_STDOUT", "false") === "true") console.log(`[dev email] to=${to} subject=${subject}\n${text}`);
    else log.warn("ACS_ENDPOINT not configured; email not sent", { subject });
    return;
  }
  client ??= new EmailClient(endpoint, new DefaultAzureCredential());
  const poller = await client.beginSend({
    senderAddress: optional("ACS_SENDER", "DoNotReply@rkjh.se"),
    recipients: { to: [{ address: to }] },
    content: { subject, plainText: text, html },
    disableUserEngagementTracking: true,
  });
  const result = await poller.pollUntilDone();
  if (result.status !== "Succeeded") throw new Error(`Email send status ${result.status}`);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
