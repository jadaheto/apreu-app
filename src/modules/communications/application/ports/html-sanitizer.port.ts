/**
 * Removes scripts, event handlers and dangerous URLs from user-authored HTML
 * (legacy bug #5: notice bodies were embedded without sanitizing).
 */
export interface HtmlSanitizerPort {
  sanitize(html: string): string;
}

export const HTML_SANITIZER = Symbol('HtmlSanitizerPort');
