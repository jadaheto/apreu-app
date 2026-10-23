/**
 * Small non-validating XML parser producing a navigable tree.
 *
 * Used to canonicalize the documents this module signs and to read DIAN SOAP
 * responses. It supports elements, attributes, text, CDATA, comments and the
 * predefined/numeric entities. DTDs are rejected (no entity expansion, so no
 * XXE / billion-laughs exposure).
 */
export interface ParsedAttribute {
  readonly name: string;
  readonly value: string;
}

export interface ParsedElement {
  readonly type: 'element';
  readonly name: string;
  readonly attributes: ParsedAttribute[];
  readonly children: ParsedNode[];
  readonly parent: ParsedElement | null;
}

export interface ParsedText {
  readonly type: 'text';
  value: string;
}

export interface ParsedComment {
  readonly type: 'comment';
  readonly value: string;
}

export type ParsedNode = ParsedElement | ParsedText | ParsedComment;

/** Thrown when the input is not well-formed XML. */
export class XmlParseError extends Error {
  constructor(message: string, position: number) {
    super(`XML inválido (posición ${position}): ${message}`);
    this.name = 'XmlParseError';
  }
}

const NAME_PATTERN = /[A-Za-z_:][-A-Za-z0-9_:.·-￿]*/y;
const PREDEFINED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Parses `xml` and returns its document element. */
export function parseXml(xml: string): ParsedElement {
  return new Parser(normalizeLineEnds(xml.replace(/^﻿/, ''))).parseDocument();
}

class Parser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parseDocument(): ParsedElement {
    let root: ParsedElement | null = null;
    while (this.pos < this.input.length) {
      if (this.startsWith('<?')) this.skipUntil('?>');
      else if (this.startsWith('<!--')) this.skipUntil('-->');
      else if (this.startsWith('<!DOCTYPE')) this.fail('No se permiten declaraciones DOCTYPE.');
      else if (this.startsWith('<')) {
        if (root) this.fail('Solo se admite un elemento raíz.');
        root = this.parseElement(null);
      } else if (/\s/.test(this.input[this.pos])) this.pos++;
      else this.fail('Contenido fuera del elemento raíz.');
    }
    if (!root) this.fail('Documento sin elemento raíz.');
    return root as ParsedElement;
  }

  private parseElement(parent: ParsedElement | null): ParsedElement {
    this.expect('<');
    const name = this.readName();
    const element: ParsedElement = { type: 'element', name, attributes: [], children: [], parent };
    for (;;) {
      this.skipWhitespace();
      if (this.startsWith('/>')) {
        this.pos += 2;
        return element;
      }
      if (this.startsWith('>')) {
        this.pos++;
        break;
      }
      const attrName = this.readName();
      this.skipWhitespace();
      this.expect('=');
      this.skipWhitespace();
      const quote = this.input[this.pos];
      if (quote !== '"' && quote !== "'") this.fail('Se esperaba un valor de atributo entre comillas.');
      const end = this.input.indexOf(quote, this.pos + 1);
      if (end < 0) this.fail('Atributo sin cerrar.');
      const raw = this.input.slice(this.pos + 1, end);
      if (raw.includes('<')) this.fail('Carácter "<" no permitido en un atributo.');
      element.attributes.push({ name: attrName, value: decodeEntities(raw.replace(/[\t\n]/g, ' '), this.pos) });
      this.pos = end + 1;
    }
    this.parseContent(element);
    return element;
  }

  private parseContent(element: ParsedElement): void {
    for (;;) {
      if (this.pos >= this.input.length) this.fail(`Elemento <${element.name}> sin cerrar.`);
      if (this.startsWith('</')) {
        this.pos += 2;
        const closing = this.readName();
        if (closing !== element.name) this.fail(`Se esperaba </${element.name}> y se encontró </${closing}>.`);
        this.skipWhitespace();
        this.expect('>');
        return;
      }
      if (this.startsWith('<!--')) {
        const end = this.skipUntil('-->');
        element.children.push({ type: 'comment', value: this.input.slice(end.start, end.end) });
      } else if (this.startsWith('<![CDATA[')) {
        const end = this.skipUntil(']]>');
        this.appendText(element, this.input.slice(end.start, end.end));
      } else if (this.startsWith('<?')) {
        this.skipUntil('?>');
      } else if (this.startsWith('<')) {
        element.children.push(this.parseElement(element));
      } else {
        const next = this.input.indexOf('<', this.pos);
        const end = next < 0 ? this.input.length : next;
        this.appendText(element, decodeEntities(this.input.slice(this.pos, end), this.pos));
        this.pos = end;
      }
    }
  }

  private appendText(element: ParsedElement, value: string): void {
    const last = element.children[element.children.length - 1];
    if (last?.type === 'text') last.value += value;
    else element.children.push({ type: 'text', value });
  }

  private readName(): string {
    NAME_PATTERN.lastIndex = this.pos;
    const match = NAME_PATTERN.exec(this.input);
    if (!match) this.fail('Nombre XML esperado.');
    this.pos += (match as RegExpExecArray)[0].length;
    return (match as RegExpExecArray)[0];
  }

  /** Moves past `terminator`; returns the span of the skipped content (after the opening token). */
  private skipUntil(terminator: string): { start: number; end: number } {
    const opening = this.input.startsWith('<![CDATA[', this.pos) ? 9 : this.input.startsWith('<!--', this.pos) ? 4 : 2;
    const start = this.pos + opening;
    const end = this.input.indexOf(terminator, start);
    if (end < 0) this.fail(`No se encontró "${terminator}".`);
    this.pos = end + terminator.length;
    return { start, end };
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) this.pos++;
  }

  private startsWith(token: string): boolean {
    return this.input.startsWith(token, this.pos);
  }

  private expect(token: string): void {
    if (!this.startsWith(token)) this.fail(`Se esperaba "${token}".`);
    this.pos += token.length;
  }

  private fail(message: string): never {
    throw new XmlParseError(message, this.pos);
  }
}

function normalizeLineEnds(xml: string): string {
  return xml.replace(/\r\n?/g, '\n');
}

function decodeEntities(value: string, position: number): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (_match, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    const decoded = PREDEFINED_ENTITIES[entity];
    if (decoded === undefined) throw new XmlParseError(`Entidad desconocida &${entity};`, position);
    return decoded;
  });
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/** Local part of a qualified name (`cbc:ID` → `ID`). */
export const localNameOf = (name: string): string => name.slice(name.indexOf(':') + 1);

/** Prefix of a qualified name (`''` when unprefixed). */
export const prefixOf = (name: string): string => (name.includes(':') ? name.slice(0, name.indexOf(':')) : '');

/** Child elements of `element`. */
export const childElements = (element: ParsedElement): ParsedElement[] =>
  element.children.filter((child): child is ParsedElement => child.type === 'element');

/** Depth-first search of the first descendant (or self) with the given local name. */
export function findFirst(element: ParsedElement, localName: string): ParsedElement | null {
  if (localNameOf(element.name) === localName) return element;
  for (const child of childElements(element)) {
    const found = findFirst(child, localName);
    if (found) return found;
  }
  return null;
}

/** All descendants (or self) with the given local name, in document order. */
export function findAll(element: ParsedElement, localName: string): ParsedElement[] {
  const matches = localNameOf(element.name) === localName ? [element] : [];
  return matches.concat(...childElements(element).map((child) => findAll(child, localName)));
}

/** First descendant whose attribute `attribute` equals `value`. */
export function findByAttribute(element: ParsedElement, attribute: string, value: string): ParsedElement | null {
  if (element.attributes.some((attr) => attr.name === attribute && attr.value === value)) return element;
  for (const child of childElements(element)) {
    const found = findByAttribute(child, attribute, value);
    if (found) return found;
  }
  return null;
}

/** Concatenated text of the element and its descendants. */
export function textContent(element: ParsedElement): string {
  return element.children
    .map((child) => (child.type === 'text' ? child.value : child.type === 'element' ? textContent(child) : ''))
    .join('');
}

/** Value of an attribute by qualified name. */
export const attributeOf = (element: ParsedElement, name: string): string | undefined =>
  element.attributes.find((attr) => attr.name === name)?.value;

/** Resolves a namespace prefix (`''` = default namespace) walking up the ancestors. */
export function lookupNamespace(element: ParsedElement | null, prefix: string): string {
  const declaration = prefix === '' ? 'xmlns' : `xmlns:${prefix}`;
  for (let current = element; current; current = current.parent) {
    const value = attributeOf(current, declaration);
    if (value !== undefined) return value;
  }
  if (prefix === 'xml') return 'http://www.w3.org/XML/1998/namespace';
  return '';
}

/** True for `xmlns` / `xmlns:*` attributes. */
export const isNamespaceDeclaration = (name: string): boolean => name === 'xmlns' || name.startsWith('xmlns:');
