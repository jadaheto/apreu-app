import type { HtmlSanitizerPort } from '../../application/ports/html-sanitizer.port.js';
import { escapeHtml } from '../../domain/common/text.js';

/** Formatting tags produced by rich-text editors (TinyMCE/Quill) and safe in e-mails. */
const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'center',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);

/** Tags removed together with everything inside them. */
const DROPPED_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'svg',
  'math',
  'textarea',
  'select',
  'title',
  'head',
  'frameset',
  'frame',
  'applet',
  'xml',
  'noembed',
  'noframes',
]);

const GLOBAL_ATTRIBUTES = new Set(['style', 'title', 'align', 'dir', 'lang']);
const CELL_ATTRIBUTES = ['colspan', 'rowspan', 'width', 'height', 'valign', 'bgcolor'];
const TAG_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'target'],
  img: ['src', 'alt', 'width', 'height'],
  table: ['width', 'border', 'cellpadding', 'cellspacing', 'bgcolor'],
  td: CELL_ATTRIBUTES,
  th: CELL_ATTRIBUTES,
  col: ['span', 'width'],
  colgroup: ['span', 'width'],
  font: ['color', 'size', 'face'],
  ol: ['start', 'type'],
  ul: ['type'],
};

const SAFE_HREF = /^(https?:|mailto:|tel:|#)/i;
const SAFE_SRC = /^(https?:|cid:|data:image\/(png|jpe?g|gif|webp);base64,)/i;
const DANGEROUS_STYLE = /expression|javascript:|vbscript:|url\s*\(|@import|behavior|binding|[<>\\]/i;

const COMMENT = /<!--[\s\S]*?(?:-->|$)/y;
const DECLARATION = /<[!?][^>]*>?/y;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const decodeEntities = (value: string): string =>
  value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);?/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) || 0xfffd);
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10) || 0xfffd);
    return (
      (
        { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', newline: '\n' } as Record<
          string,
          string
        >
      )[lower] ?? entity
    );
  });

/**
 * Allowlist HTML sanitizer for notice bodies (legacy bug #5), implemented
 * without external libraries:
 *
 * - only formatting tags are kept; scripts, frames, forms, SVG… are removed
 *   with their content and comments/doctype are dropped;
 * - only known attributes survive; event handlers (`on*`) never do;
 * - URLs are limited to http(s)/mailto/tel (links) and http(s)/cid/inline
 *   raster images (images), after decoding entities to defeat obfuscation;
 * - `style` values with `url()`, `expression()` or scripts are removed;
 * - output is well formed: unclosed tags are closed, stray `<` escaped.
 */
export class AllowlistHtmlSanitizer implements HtmlSanitizerPort {
  sanitize(html: string): string {
    const input = html ?? '';
    const open: string[] = [];
    let output = '';
    let index = 0;

    while (index < input.length) {
      const next = input.indexOf('<', index);
      if (next < 0) {
        output += input.slice(index);
        break;
      }
      output += input.slice(index, next);
      index = next;

      const skipped = this.matchAt(COMMENT, input, index) ?? this.matchAt(DECLARATION, input, index);
      if (skipped) {
        index += skipped[0].length;
        continue;
      }
      const tag = this.matchAt(TAG, input, index);
      if (!tag) {
        output += '&lt;';
        index += 1;
        continue;
      }
      index += tag[0].length;
      const closing = tag[1] === '/';
      const name = tag[2].toLowerCase();

      if (DROPPED_WITH_CONTENT.has(name)) {
        if (!closing && !tag[3].trim().endsWith('/')) index = this.skipElement(input, index, name);
        continue;
      }
      if (!ALLOWED_TAGS.has(name)) continue;

      if (closing) {
        const position = open.lastIndexOf(name);
        if (position >= 0) {
          output += open
            .splice(position)
            .reverse()
            .map((item) => `</${item}>`)
            .join('');
        }
        continue;
      }
      output += `<${name}${this.attributes(name, tag[3])}>`;
      if (!VOID_TAGS.has(name)) open.push(name);
    }
    return (
      output +
      open
        .reverse()
        .map((item) => `</${item}>`)
        .join('')
    );
  }

  private matchAt(pattern: RegExp, input: string, index: number): RegExpExecArray | null {
    pattern.lastIndex = index;
    return pattern.exec(input);
  }

  /** Index right after the closing tag of a dropped element (or the end of input). */
  private skipElement(input: string, from: number, name: string): number {
    const closing = new RegExp(`</${name}\\s*>`, 'ig');
    closing.lastIndex = from;
    const match = closing.exec(input);
    return match ? match.index + match[0].length : input.length;
  }

  private attributes(tag: string, raw: string): string {
    const allowed = TAG_ATTRIBUTES[tag] ?? [];
    let result = '';
    let hasTarget = false;
    for (const match of raw.matchAll(ATTRIBUTE)) {
      const name = match[1].toLowerCase();
      if (!GLOBAL_ATTRIBUTES.has(name) && !allowed.includes(name)) continue;
      const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
      const safe = this.safeValue(name, value);
      if (safe === null) continue;
      if (name === 'target') hasTarget = true;
      result += ` ${name}="${escapeHtml(safe)}"`;
    }
    if (tag === 'a' && hasTarget) result += ' rel="noopener noreferrer"';
    return result;
  }

  private safeValue(name: string, value: string): string | null {
    // Control characters and whitespace inside a scheme ("java\tscript:") are ignored by browsers.
    // oxlint-disable-next-line no-control-regex
    const compact = value.replace(/[\u0000- \u007f-\u009f]/g, '');
    switch (name) {
      case 'href':
        return SAFE_HREF.test(compact) ? value.trim() : null;
      case 'src':
        return SAFE_SRC.test(compact) ? value.trim() : null;
      case 'style':
        return DANGEROUS_STYLE.test(value) ? null : value;
      case 'target':
        return value === '_blank' ? value : null;
      default:
        return value;
    }
  }
}
