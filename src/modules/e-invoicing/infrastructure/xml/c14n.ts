import { isNamespaceDeclaration, lookupNamespace, type ParsedElement, prefixOf, localNameOf } from './xml-parser.js';

/** Algorithm identifiers used in `ds:CanonicalizationMethod` / `ds:Transform`. */
export const C14N_INCLUSIVE = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
export const C14N_EXCLUSIVE = 'http://www.w3.org/2001/10/xml-exc-c14n#';

export interface CanonicalizationOptions {
  /** Exclusive C14N (only visibly utilized namespaces). Default: inclusive. */
  exclusive?: boolean;
  /** Elements removed from the output (enveloped-signature transform). */
  exclude?: (element: ParsedElement) => boolean;
}

/**
 * Canonical XML 1.0 (without comments) of `apex` and its subtree.
 *
 * - Inclusive mode renders, on the apex, every namespace in scope (including
 *   those declared by ancestors), as required when a referenced fragment is
 *   digested "in context" (XAdES `KeyInfo`, `SignedProperties`, `SignedInfo`).
 * - Exclusive mode renders only the namespaces each element visibly uses
 *   (WS-Security `Timestamp`, `To`, `SignedInfo`).
 *
 * Namespace declarations are sorted with the default namespace first and then
 * by prefix; attributes by namespace URI and local name; empty elements are
 * expanded; text and attribute values use the C14N escaping rules.
 */
export function canonicalize(apex: ParsedElement, options: CanonicalizationOptions = {}): string {
  return renderElement(apex, new Map(), options);
}

function renderElement(
  element: ParsedElement,
  rendered: Map<string, string>,
  options: CanonicalizationOptions,
): string {
  const declarations = options.exclusive
    ? exclusiveNamespaces(element, rendered)
    : inclusiveNamespaces(element, rendered);
  const inScope = new Map(rendered);
  declarations.forEach(([prefix, uri]) => inScope.set(prefix, uri));

  const namespaceAttrs = declarations
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([prefix, uri]) => ` ${prefix ? `xmlns:${prefix}` : 'xmlns'}="${escapeAttributeValue(uri)}"`)
    .join('');
  const attributes = element.attributes
    .filter((attr) => !isNamespaceDeclaration(attr.name))
    .map((attr) => {
      const prefix = prefixOf(attr.name);
      return { attr, key: [prefix ? lookupNamespace(element, prefix) : '', localNameOf(attr.name)] as const };
    })
    .sort((a, b) => compareKeys(a.key, b.key))
    .map(({ attr }) => ` ${attr.name}="${escapeAttributeValue(attr.value)}"`)
    .join('');

  const content = element.children
    .map((child) => {
      if (child.type === 'text') return escapeTextValue(child.value);
      if (child.type === 'element' && !options.exclude?.(child)) return renderElement(child, inScope, options);
      return '';
    })
    .join('');
  return `<${element.name}${namespaceAttrs}${attributes}>${content}</${element.name}>`;
}

/** All namespaces in scope whose binding differs from what output ancestors already rendered. */
function inclusiveNamespaces(element: ParsedElement, rendered: Map<string, string>): [string, string][] {
  const inScope = new Map<string, string>();
  const chain: ParsedElement[] = [];
  for (let current: ParsedElement | null = element; current; current = current.parent) chain.unshift(current);
  for (const node of chain) {
    for (const attr of node.attributes) {
      if (attr.name === 'xmlns') inScope.set('', attr.value);
      else if (attr.name.startsWith('xmlns:')) inScope.set(attr.name.slice(6), attr.value);
    }
  }
  return [...inScope].filter(([prefix, uri]) => needsDeclaration(prefix, uri, rendered));
}

/** Namespaces visibly utilized by the element name and its attributes. */
function exclusiveNamespaces(element: ParsedElement, rendered: Map<string, string>): [string, string][] {
  const prefixes = new Set<string>([prefixOf(element.name)]);
  element.attributes
    .filter((attr) => !isNamespaceDeclaration(attr.name))
    .map((attr) => prefixOf(attr.name))
    .filter((prefix) => prefix !== '' && prefix !== 'xml')
    .forEach((prefix) => prefixes.add(prefix));
  return [...prefixes]
    .map((prefix): [string, string] => [prefix, lookupNamespace(element, prefix)])
    .filter(([prefix, uri]) => needsDeclaration(prefix, uri, rendered));
}

function needsDeclaration(prefix: string, uri: string, rendered: Map<string, string>): boolean {
  if (prefix === 'xml') return false;
  if (prefix === '' && uri === '') return (rendered.get('') ?? '') !== '';
  return rendered.get(prefix) !== uri;
}

function compareKeys(a: readonly [string, string], b: readonly [string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

function escapeTextValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
}

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;');
}
