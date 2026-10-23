import { randomBytes } from 'node:crypto';
import type { EmailAttachment } from '../../../domain/email/email-attachment.js';

/** A mailbox: address plus optional display name. */
export interface Mailbox {
  email: string;
  name?: string | null;
}

export interface MimeMessageInput {
  from: Mailbox;
  to: Mailbox;
  subject: string;
  html: string;
  text: string;
  attachments: readonly EmailAttachment[];
  date: Date;
  /** Domain used for the `Message-ID`. */
  messageIdDomain: string;
}

const CRLF = '\r\n';
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const ADDRESS = /^[^\s<>"(),;:\\[\]]+@[^\s<>"(),;:\\[\]]+$/;

/** Thrown when a header value could be used to inject other headers. */
export class MimeInjectionError extends Error {}

const assertSingleLine = (value: string, field: string): void => {
  if (/[\r\n]/.test(value)) throw new MimeInjectionError(`El campo ${field} contiene saltos de línea.`);
};

/** Validates an address so it can be used both in headers and in `MAIL FROM`/`RCPT TO`. */
export const assertAddress = (email: string): void => {
  assertSingleLine(email, 'correo');
  if (!ADDRESS.test(email)) throw new MimeInjectionError(`Dirección de correo inválida: ${email}`);
};

/** Base64 wrapped at 76 characters per line (RFC 2045). */
const base64Lines = (content: Buffer): string => (content.toString('base64').match(/.{1,76}/g) ?? []).join(CRLF);

/**
 * RFC 2047 encoded-words for non-ASCII header text. Words are split on
 * character boundaries so multi-byte UTF-8 sequences are never cut.
 */
export const encodeHeaderText = (value: string): string => {
  assertSingleLine(value, 'encabezado');
  if (PRINTABLE_ASCII.test(value)) return value;
  const words: string[] = [];
  let chunk = '';
  for (const char of value) {
    if (Buffer.byteLength(chunk + char, 'utf8') > 45) {
      words.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word, 'utf8').toString('base64')}?=`).join(`${CRLF} `);
};

/** `"Name" <email>` with the name quoted or encoded. */
export const formatMailbox = ({ email, name }: Mailbox): string => {
  assertAddress(email);
  const display = name?.trim();
  if (!display) return `<${email}>`;
  const encoded = PRINTABLE_ASCII.test(display)
    ? `"${display.replace(/(["\\])/g, '\\$1')}"`
    : encodeHeaderText(display);
  return `${encoded} <${email}>`;
};

const boundary = (): string => `=_apreu_${randomBytes(12).toString('hex')}`;

const fileNameParameter = (filename: string): string => {
  assertSingleLine(filename, 'nombre de archivo');
  return PRINTABLE_ASCII.test(filename)
    ? `filename="${filename.replace(/(["\\])/g, '\\$1')}"`
    : `filename*=UTF-8''${encodeURIComponent(filename)}`;
};

const part = (headers: string[], body: string): string => `${headers.join(CRLF)}${CRLF}${CRLF}${body}`;

const multipart = (subtype: string, parts: string[]): string => {
  const separator = boundary();
  const body = parts.map((item) => `--${separator}${CRLF}${item}`).join(CRLF) + `${CRLF}--${separator}--`;
  return part([`Content-Type: multipart/${subtype}; boundary="${separator}"`], body);
};

const textPart = (subtype: 'plain' | 'html', content: string): string =>
  part(
    [`Content-Type: text/${subtype}; charset=UTF-8`, 'Content-Transfer-Encoding: base64'],
    base64Lines(Buffer.from(content, 'utf8')),
  );

const attachmentPart = (attachment: EmailAttachment): string => {
  assertSingleLine(attachment.contentType, 'tipo de contenido');
  const headers = [
    `Content-Type: ${attachment.contentType}; name="${attachment.filename.replace(/(["\\\r\n])/g, '_')}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: ${attachment.contentId ? 'inline' : 'attachment'}; ${fileNameParameter(attachment.filename)}`,
  ];
  if (attachment.contentId) {
    assertSingleLine(attachment.contentId, 'Content-ID');
    headers.push(`Content-ID: <${attachment.contentId}>`);
  }
  return part(headers, base64Lines(attachment.content));
};

/**
 * Builds an RFC 5322 message:
 * `mixed[ related[ alternative[text, html], inline images ], attachments ]`,
 * omitting the containers that are not needed. Every header value is
 * checked against CR/LF injection.
 */
export const buildMimeMessage = (input: MimeMessageInput): string => {
  const inline = input.attachments.filter((attachment) => attachment.contentId);
  const files = input.attachments.filter((attachment) => !attachment.contentId);

  let body = multipart('alternative', [textPart('plain', input.text), textPart('html', input.html)]);
  if (inline.length > 0) body = multipart('related', [body, ...inline.map(attachmentPart)]);
  if (files.length > 0) body = multipart('mixed', [body, ...files.map(attachmentPart)]);

  const headers = [
    `From: ${formatMailbox(input.from)}`,
    `To: ${formatMailbox(input.to)}`,
    `Subject: ${encodeHeaderText(input.subject)}`,
    `Date: ${input.date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${input.messageIdDomain}>`,
    'MIME-Version: 1.0',
    'X-Mailer: Apreu ERP',
  ];
  return `${headers.join(CRLF)}${CRLF}${body}`;
};
