/**
 * Minimal XML tree + serializer used to emit UBL documents.
 *
 * The output reproduces PHP `DOMDocument` with `formatOutput = true` (the
 * legacy `InvoiceGenerator.php`): `standalone="no"` declaration, 2-space
 * indentation, elements whose content is text stay on one line and empty
 * elements are self-closed. Elements are emitted exactly once and never
 * re-formatted after signing (the signature covers these bytes).
 */
export type XmlNode = XmlElement | XmlText | XmlComment | XmlCData;

export interface XmlElement {
  readonly kind: 'element';
  readonly name: string;
  readonly attributes: ReadonlyArray<readonly [string, string]>;
  readonly children: readonly XmlNode[];
}

export interface XmlText {
  readonly kind: 'text';
  readonly value: string;
}

export interface XmlComment {
  readonly kind: 'comment';
  readonly value: string;
}

export interface XmlCData {
  readonly kind: 'cdata';
  readonly value: string;
}

/** Attribute map; `undefined`/`null` values are omitted. Insertion order is kept. */
export type XmlAttributes = Record<string, string | number | null | undefined>;

/** Child list entries; falsy entries are skipped so optional groups read naturally. */
export type XmlChild = XmlNode | string | null | undefined | false;

/** Builds an element. A string `content` becomes its only text child. */
export function el(
  name: string,
  attributes: XmlAttributes = {},
  content: XmlChild[] | string | number = [],
): XmlElement {
  const attrs = Object.entries(attributes)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== null)
    .map(([key, value]) => [key, String(value)] as const);
  const children: XmlNode[] =
    typeof content === 'string' || typeof content === 'number'
      ? [text(String(content))]
      : content
          .filter((child): child is XmlNode | string => Boolean(child) || child === '')
          .map((child) => (typeof child === 'string' ? text(child) : child));
  return { kind: 'element', name, attributes: attrs, children };
}

export const text = (value: string): XmlText => ({ kind: 'text', value });
export const comment = (value: string): XmlComment => ({ kind: 'comment', value });
export const cdata = (value: string): XmlCData => ({ kind: 'cdata', value });

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
const INDENT = '  ';

/** Serializes a complete document (declaration + root + trailing newline). */
export function serializeDocument(root: XmlElement): string {
  return `${XML_DECLARATION}\n${serializeNode(root, 0)}\n`;
}

function serializeNode(node: XmlNode, depth: number): string {
  switch (node.kind) {
    case 'text':
      return escapeText(node.value);
    case 'comment':
      return `<!--${node.value}-->`;
    case 'cdata':
      // "]]>" cannot appear inside a CDATA section: split it across two sections.
      return `<![CDATA[${node.value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
    case 'element':
      return serializeElement(node, depth);
  }
}

function serializeElement(element: XmlElement, depth: number): string {
  const attrs = element.attributes.map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join('');
  if (element.children.length === 0) return `<${element.name}${attrs}/>`;
  const inline = element.children.some((child) => child.kind === 'text' || child.kind === 'cdata');
  if (inline) {
    return `<${element.name}${attrs}>${element.children.map((child) => serializeNode(child, depth + 1)).join('')}</${element.name}>`;
  }
  const childIndent = `\n${INDENT.repeat(depth + 1)}`;
  const body = element.children.map((child) => childIndent + serializeNode(child, depth + 1)).join('');
  return `<${element.name}${attrs}>${body}\n${INDENT.repeat(depth)}</${element.name}>`;
}

/** Escapes character data like libxml (`&`, `<`, `>`, CR). */
export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
}

/** Escapes an attribute value delimited by double quotes. */
export function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}
