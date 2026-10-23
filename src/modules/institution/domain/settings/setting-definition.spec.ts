import { SettingCodec, type SettingDefinition } from './setting-definition.js';

const def = (override: Partial<SettingDefinition>): SettingDefinition => ({
  key: 'k',
  label: 'Campo',
  type: 'text',
  ...override,
});

describe('SettingCodec.encode', () => {
  it.each([
    [def({ type: 'integer', min: 1, max: 10 }), '7', '7'],
    [def({ type: 'decimal', min: 0 }), 0.522, '0.522'],
    [def({ type: 'boolean' }), false, '0'],
    [def({ type: 'boolean' }), true, '1'],
    [def({ type: 'enum', options: ['a', 'b'] }), 'b', 'b'],
    [def({ type: 'enum-set', options: ['a', 'b', 'c'] }), ['c', 'a', 'c'], 'c,a'],
    [def({ type: 'enum-set', options: ['a'] }), [], ''],
    [def({ type: 'hex-color' }), '#ABCDEF', '#abcdef'],
    [def({ type: 'email' }), ' X@Colegio.CO ', 'x@colegio.co'],
    [def({ type: 'url' }), 'https://n8n.colegio.co/webhook/x', 'https://n8n.colegio.co/webhook/x'],
    [def({ type: 'date' }), '2026-02-28', '2026-02-28'],
    [def({ pattern: /^\d+$/ }), ' 123 ', '123'],
  ])('%o encodes %o as %o', (definition, raw, stored) => {
    expect(SettingCodec.encode(definition, raw)).toBe(stored);
  });

  it.each([null, undefined, '', '   '])('clears with %o', (raw) => {
    expect(SettingCodec.encode(def({ type: 'integer' }), raw)).toBeNull();
  });

  it.each([
    [def({ type: 'integer' }), '1.5'],
    [def({ type: 'integer', max: 10 }), 11],
    [def({ type: 'decimal', min: 0 }), -1],
    [def({ type: 'decimal' }), 'abc'],
    [def({ type: 'boolean' }), 'si'],
    [def({ type: 'enum', options: ['a'] }), 'z'],
    [def({ type: 'enum-set', options: ['a'] }), 'a'],
    [def({ type: 'enum-set', options: ['a'] }), ['a', 'z']],
    [def({ type: 'hex-color' }), 'red;}body{display:none'],
    [def({ type: 'email' }), 'nope'],
    [def({ type: 'url' }), 'http://inseguro.co'],
    [def({ type: 'url' }), 'no es url'],
    [def({ type: 'date' }), '2026-02-30'],
    [def({ maxLength: 3 }), 'abcd'],
    [def({}), 'con\u0000nulo'],
    [def({}), 42],
    [def({ pattern: /^\d+$/ }), '12a'],
  ])('%o rejects %o', (definition, raw) => {
    expect(() => SettingCodec.encode(definition, raw)).toThrow(expect.objectContaining({ code: 'INVALID_SETTING' }));
  });
});

describe('SettingCodec.decode', () => {
  it.each([
    [def({ type: 'integer' }), '40', 40],
    [def({ type: 'integer' }), 'x', null],
    [def({ type: 'boolean' }), '0', false],
    [def({ type: 'boolean' }), 'true', true],
    [def({ type: 'enum', options: ['a'] }), 'z', null],
    [def({ type: 'enum-set', options: ['a', 'b'] }), 'a, z ,b', ['a', 'b']],
    [def({ type: 'enum-set', options: ['a'] }), null, []],
    [def({ type: 'date' }), '19/01/2019', '2019-01-19'],
    [def({ type: 'date' }), '2026-01-05 00:00:00', '2026-01-05'],
    [def({ type: 'date' }), 'pronto', null],
    [def({ type: 'hex-color' }), 'rojo', null],
    [def({}), ' texto ', 'texto'],
    [def({}), '', null],
  ])('%o decodes %o as %o', (definition, stored, value) => {
    expect(SettingCodec.decode(definition, stored)).toEqual(value);
  });

  it('computes static and dynamic defaults', () => {
    const now = new Date('2027-03-01T12:00:00Z');
    expect(SettingCodec.defaultFor(def({ defaultValue: 'x' }), { now })).toBe('x');
    expect(SettingCodec.defaultFor(def({ defaultValue: (c) => String(c.now.getFullYear()) }), { now })).toBe('2027');
    expect(SettingCodec.defaultFor(def({}), { now })).toBeNull();
  });
});
