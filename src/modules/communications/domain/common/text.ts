/**
 * Text helpers shared by the communication templates and logs.
 * Pure functions, no framework dependencies.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Escapes a value for safe interpolation in HTML text or attribute values (legacy bug #28). */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** Converts HTML into collapsed plain text (equivalent of PHP `strip_tags` + entity decoding). */
export const htmlToPlainText = (html: string): string =>
  (html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X'))
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Cuts a string to `max` characters (code points are not split). */
export const truncate = (value: string | null | undefined, max: number): string => {
  const chars = Array.from(value ?? '');
  return chars.length > max ? chars.slice(0, max).join('') : (value ?? '');
};

/** True when the text contains CR or LF (header injection guard). */
export const hasLineBreak = (value: string): boolean => /[\r\n]/.test(value);
