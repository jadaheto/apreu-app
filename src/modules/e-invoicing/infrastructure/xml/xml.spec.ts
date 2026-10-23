import { canonicalize } from './c14n.js';
import {
  attributeOf,
  findAll,
  findByAttribute,
  findFirst,
  lookupNamespace,
  parseXml,
  textContent,
} from './xml-parser.js';
import { cdata, comment, el, serializeDocument } from './xml-writer.js';

describe('serializeDocument', () => {
  it('reproduces DOMDocument formatOutput (declaration, 2-space indent, inline text, self-closing)', () => {
    const xml = serializeDocument(
      el('Invoice', { xmlns: 'urn:inv', 'xmlns:cbc': 'urn:cbc', skip: undefined }, [
        el('cbc:ID', { schemeID: 'a"b' }, 'A & B <c>'),
        el('cac:Empty'),
        el('cac:Group', {}, [el('cbc:Note', {}, 'ñ'), comment(' X '), false, null]),
        el('cbc:Description', {}, [cdata('<a>]]></a>')]),
      ]),
    );
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
        '<Invoice xmlns="urn:inv" xmlns:cbc="urn:cbc">\n' +
        '  <cbc:ID schemeID="a&quot;b">A &amp; B &lt;c&gt;</cbc:ID>\n' +
        '  <cac:Empty/>\n' +
        '  <cac:Group>\n    <cbc:Note>ñ</cbc:Note>\n    <!-- X -->\n  </cac:Group>\n' +
        '  <cbc:Description><![CDATA[<a>]]]]><![CDATA[></a>]]></cbc:Description>\n' +
        '</Invoice>\n',
    );
  });
});

describe('parseXml', () => {
  it('parses entities, CDATA, attributes and namespaces', () => {
    const root = parseXml(
      `<?xml version="1.0"?>\r\n<a xmlns="urn:a" xmlns:b="urn:b"><b:c id='1' t="x&#10;y\tz">1 &lt; 2 &amp;&#x41;</b:c><![CDATA[<raw>]]><!-- c --></a>`,
    );
    const child = findFirst(root, 'c')!;
    expect(textContent(child)).toBe('1 < 2 &A');
    expect(attributeOf(child, 't')).toBe('x\ny z');
    expect(textContent(root)).toBe('1 < 2 &A<raw>');
    expect(lookupNamespace(child, 'b')).toBe('urn:b');
    expect(lookupNamespace(child, '')).toBe('urn:a');
    expect(findAll(root, 'c')).toHaveLength(1);
    expect(findByAttribute(root, 'id', '1')).toBe(child);
  });

  it.each([
    ['<!DOCTYPE a [<!ENTITY x "y">]><a/>', 'DOCTYPE'],
    ['<a><b></a>', 'Se esperaba'],
    ['<a>&unknown;</a>', 'Entidad'],
    ['<a/><b/>', 'raíz'],
  ])('rejects %s', (xml, message) => {
    expect(() => parseXml(xml)).toThrow(message);
  });
});

describe('canonicalize', () => {
  // Expected outputs cross-checked with `xmllint --c14n` / `--exc-c14n`.
  const xml =
    '<Invoice xmlns="urn:inv" xmlns:cbc="urn:cbc" xmlns:ext="urn:ext" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="a b">\n' +
    '  <cbc:ID b="1" a="x&quot;y&#9;z">A &amp; B &gt;</cbc:ID>\n' +
    '  <cbc:Empty/><!-- comment -->\n' +
    '  <Other xmlns="urn:other" xmlns:z="urn:z" z:k="v" k="w"><cbc:In>x</cbc:In><z:Q xmlns:cbc="urn:cbc">y</z:Q></Other>\n' +
    '</Invoice>';

  it('inclusive C14N of the whole document', () => {
    expect(canonicalize(parseXml(xml))).toBe(
      '<Invoice xmlns="urn:inv" xmlns:cbc="urn:cbc" xmlns:ext="urn:ext" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="a b">\n' +
        '  <cbc:ID a="x&quot;y&#x9;z" b="1">A &amp; B &gt;</cbc:ID>\n' +
        '  <cbc:Empty></cbc:Empty>\n' +
        '  <Other xmlns="urn:other" xmlns:z="urn:z" k="w" z:k="v"><cbc:In>x</cbc:In><z:Q>y</z:Q></Other>\n' +
        '</Invoice>',
    );
  });

  it('inclusive C14N of a fragment inherits the ancestor namespaces', () => {
    const other = findFirst(parseXml(xml), 'Other')!;
    expect(canonicalize(other)).toBe(
      '<Other xmlns="urn:other" xmlns:cbc="urn:cbc" xmlns:ext="urn:ext" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:z="urn:z" k="w" z:k="v"><cbc:In>x</cbc:In><z:Q>y</z:Q></Other>',
    );
  });

  it('exclusive C14N only renders visibly used namespaces', () => {
    const other = findFirst(parseXml(xml), 'Other')!;
    expect(canonicalize(other, { exclusive: true })).toBe(
      '<Other xmlns="urn:other" xmlns:z="urn:z" k="w" z:k="v"><cbc:In xmlns:cbc="urn:cbc">x</cbc:In><z:Q>y</z:Q></Other>',
    );
  });

  it('removes excluded elements but keeps surrounding whitespace (enveloped signature)', () => {
    const root = parseXml('<a>\n  <s:Signature xmlns:s="urn:s"><x/></s:Signature>\n</a>');
    expect(canonicalize(root, { exclude: (e) => e.name === 's:Signature' })).toBe('<a>\n  \n</a>');
  });
});
