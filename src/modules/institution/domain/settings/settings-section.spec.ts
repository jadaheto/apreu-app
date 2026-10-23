import { Role } from '../../../../shared/domain/role.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { SETTINGS_CATALOG, SettingsCatalog, type SettingsSectionDefinition } from './settings-catalog.js';
import { SECRET_MASK, SettingsSection } from './settings-section.js';

const now = new Date('2026-03-15T10:00:00-05:00');
const load = (key: keyof typeof SETTINGS_CATALOG, stored: Record<string, string | null> = {}) =>
  SettingsSection.load(SETTINGS_CATALOG[key], new Map(Object.entries(stored)), { now });

describe('SettingsSection', () => {
  describe('values', () => {
    it('applies defaults, including the current year for an empty academic year (legacy B26)', () => {
      expect(load('academic', { academic_year: '' }).values()).toMatchObject({
        academic_year: 2026,
        costs_matricula: null,
      });
      expect(load('branding').values()).toEqual({
        color_primary: '#4f46e5',
        color_header_bg: '#ffffff',
        color_header_bar: '#4f46e5',
        logo_size: 40,
      });
    });

    it('reads legacy duplicated keys as fallback (primary_color, smtp_user)', () => {
      expect(load('branding', { primary_color: '#112233' }).values().color_primary).toBe('#112233');
      expect(load('branding', { primary_color: '#112233', color_primary: '#445566' }).values().color_primary).toBe(
        '#445566',
      );
      expect(load('invoice-email', { smtp_user: 'facturas@c.co' }).values()).toMatchObject({
        smtp_username: 'facturas@c.co',
      });
    });

    it('masks secrets and never returns their value', () => {
      const values = load('integrations', { whatsapp_token: 'EAAG-secreto', smtp_general_password: '' }).values();
      expect(values.whatsapp_token).toBe(SECRET_MASK);
      expect(values.smtp_general_password).toBeNull();
      expect(JSON.stringify(load('ai', { n8n_webhook_url: 'https://n8n/x?token=abc' }).values())).not.toContain('abc');
    });
  });

  describe('change', () => {
    it('validates, writes aliases in sync and reports changed keys only', () => {
      const section = load('branding', { color_primary: '#4f46e5', logo_size: '40' });
      const { writes, changedKeys } = section.change({ color_primary: '#ABCDEF', logo_size: 40 });
      expect(changedKeys).toEqual(['color_primary']);
      expect(writes).toEqual(
        new Map([
          ['color_primary', '#abcdef'],
          ['primary_color', '#abcdef'],
        ]),
      );
    });

    it('keeps a secret sent back as the mask and clears it with null', () => {
      const section = load('integrations', { whatsapp_token: 'viejo' });
      expect(section.change({ whatsapp_token: SECRET_MASK }).writes.size).toBe(0);
      expect(section.change({ whatsapp_token: 'nuevo' }).writes.get('whatsapp_token')).toBe('nuevo');
      expect(section.change({ whatsapp_token: null }).writes.get('whatsapp_token')).toBeNull();
    });

    it('stores explicit false for module switches (legacy B4)', () => {
      expect(load('modules').change({ module_payroll: false }).writes.get('module_payroll')).toBe('0');
    });

    it('rejects keys of other sections and read-only keys', () => {
      expect(() => load('branding').change({ school_name: 'X' })).toThrow(
        expect.objectContaining({ code: 'UNKNOWN_SETTING' }),
      );
      expect(() => load('invoice-email').change({ dian_software_pin: '1' })).toThrow(
        expect.objectContaining({ code: 'UNKNOWN_SETTING' }),
      );
      expect(() => load('payments').change({ payment_methods: ['bitcoin'] })).toThrow(
        expect.objectContaining({ code: 'INVALID_SETTING' }),
      );
    });
  });

  describe('generic section features', () => {
    // Synthetic section exercising read-only keys, derivations and cross-field rules.
    const range: SettingsSectionDefinition = {
      key: 'academic',
      label: 'Rango',
      editors: [],
      settings: [
        { key: 'range_from', label: 'Desde', type: 'integer', min: 1 },
        { key: 'range_to', label: 'Hasta', type: 'integer', min: 1 },
        { key: 'range_size', label: 'Tamaño', type: 'text', readOnly: true },
      ],
      rules: [
        (values) => {
          if (Number(values.get('range_from')) > Number(values.get('range_to'))) {
            throw new BusinessRuleViolationError('Rango inválido', 'INVALID_RANGE');
          }
        },
      ],
      derive: (values) => ({ range_size: String(Number(values.get('range_to')) - Number(values.get('range_from'))) }),
    };
    const section = () =>
      SettingsSection.load(
        range,
        new Map([
          ['range_from', '100'],
          ['range_to', '200'],
        ]),
        { now },
      );

    it('rejects writes to read-only keys', () => {
      expect(() => section().change({ range_size: '3' })).toThrow(
        expect.objectContaining({ code: 'READ_ONLY_SETTING' }),
      );
    });

    it('derives computed keys from the merged values', () => {
      const { writes, changedKeys } = section().change({ range_to: 250 });
      expect(writes.get('range_size')).toBe('150');
      expect(changedKeys).toEqual(['range_to', 'range_size']);
    });

    it('enforces section rules on the merged values', () => {
      expect(() => section().change({ range_to: 50 })).toThrow(expect.objectContaining({ code: 'INVALID_RANGE' }));
    });
  });

  it('lists canonical keys and aliases to load', () => {
    expect(SettingsSection.keysOf(SETTINGS_CATALOG.branding)).toEqual([
      'color_primary',
      'primary_color',
      'color_header_bg',
      'color_header_bar',
      'logo_size',
    ]);
  });
});

describe('SettingsCatalog', () => {
  it.each([
    [Role.ADMIN, ['academic', 'invoice-email', 'payments', 'payroll', 'branding', 'modules', 'integrations', 'ai']],
    [
      Role.SUPERADMIN,
      ['academic', 'invoice-email', 'payments', 'payroll', 'branding', 'modules', 'integrations', 'ai'],
    ],
    [Role.FINANCE, ['invoice-email', 'payments']],
    [Role.HR, ['payroll']],
    [Role.TEACHER, []],
  ])('%s edits %o', (role, sections) => {
    expect(SettingsCatalog.sectionsFor(role).map((s) => s.key)).toEqual(sections);
  });

  it('rejects unknown sections and sections outside the role', () => {
    expect(() => SettingsCatalog.editableSection(Role.ADMIN, 'nada')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
    expect(() => SettingsCatalog.editableSection(Role.HR, 'invoice-email')).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(SettingsCatalog.editableSection(Role.FINANCE, 'payments').key).toBe('payments');
  });

  it('never declares a key twice and keeps institution identity keys out', () => {
    const keys = Object.values(SETTINGS_CATALOG).flatMap((section) => SettingsSection.keysOf(section));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toEqual(expect.arrayContaining(['school_name']));
    expect(keys).not.toContain('logo');
    expect(keys.every((key) => key.length <= 50)).toBe(true);
  });
});
