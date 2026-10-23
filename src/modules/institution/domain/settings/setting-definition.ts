import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Email } from '../../../../shared/domain/value-objects/email.vo.js';

/** Value types of the typed settings catalog. Everything is stored as text in `settings.value`. */
export type SettingType =
  'text' | 'integer' | 'decimal' | 'boolean' | 'enum' | 'enum-set' | 'hex-color' | 'email' | 'url' | 'date';

/** Value as exposed to clients. */
export type SettingValue = string | number | boolean | string[] | null;

/** Context used to compute dynamic defaults. */
export interface SettingDefaultsContext {
  now: Date;
}

/** Declaration of one setting key. */
export interface SettingDefinition {
  key: string;
  label: string;
  type: SettingType;
  /** Written by the client but only ever returned masked. */
  secret?: boolean;
  /** Computed by the section (e.g. the NIT check digit); rejected as input. */
  readOnly?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** Extra format rule for `text` values. */
  pattern?: RegExp;
  /** Stored representation used when the key has no value. */
  defaultValue?: string | ((context: SettingDefaultsContext) => string);
  /**
   * Legacy duplicated keys holding the same datum (analysis 01 §4, D4).
   * They are read as fallback and written in sync so consumers that still
   * read the old name keep working.
   */
  aliases?: readonly string[];
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ISO_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const LEGACY_DAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const invalid = (definition: SettingDefinition, reason: string): BusinessRuleViolationError =>
  new BusinessRuleViolationError(`Valor inválido para "${definition.label}": ${reason}`, 'INVALID_SETTING', {
    key: definition.key,
  });

const isValidDay = (day: string): boolean =>
  ISO_DAY.test(day) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);

const toNumber = (definition: SettingDefinition, raw: unknown, integer: boolean): number => {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw invalid(definition, integer ? 'debe ser un número entero.' : 'debe ser un número.');
  }
  if (
    (definition.min !== undefined && value < definition.min) ||
    (definition.max !== undefined && value > definition.max)
  ) {
    throw invalid(definition, `debe estar entre ${definition.min ?? '-∞'} y ${definition.max ?? '∞'}.`);
  }
  return value;
};

const toText = (definition: SettingDefinition, raw: unknown): string => {
  if (typeof raw !== 'string') throw invalid(definition, 'debe ser texto.');
  const value = raw.trim();
  if (CONTROL_CHARS.test(value)) throw invalid(definition, 'contiene caracteres no permitidos.');
  if (value.length > (definition.maxLength ?? 255))
    throw invalid(definition, `máximo ${definition.maxLength ?? 255} caracteres.`);
  return value;
};

/**
 * Converts between client values and the stored text of a setting,
 * validating types, ranges and formats (no free-form values reach the table,
 * which also closes the CSS/HTML injection of legacy S17).
 */
export const SettingCodec = {
  /** Validates a client value and returns its stored form; `null`/blank clears the setting. */
  encode(definition: SettingDefinition, raw: unknown): string | null {
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return null;
    switch (definition.type) {
      case 'integer':
      case 'decimal':
        return String(toNumber(definition, raw, definition.type === 'integer'));
      case 'boolean':
        if (typeof raw !== 'boolean') throw invalid(definition, 'debe ser verdadero o falso.');
        return raw ? '1' : '0';
      case 'enum': {
        const value = toText(definition, raw);
        if (!definition.options?.includes(value))
          throw invalid(definition, `opciones: ${definition.options?.join(', ')}.`);
        return value;
      }
      case 'enum-set': {
        if (!Array.isArray(raw)) throw invalid(definition, 'debe ser una lista.');
        const values = [...new Set(raw.map((item) => toText(definition, item)))];
        const unknown = values.filter((value) => !definition.options?.includes(value));
        if (unknown.length) throw invalid(definition, `opciones no permitidas: ${unknown.join(', ')}.`);
        return values.join(',');
      }
      case 'hex-color': {
        const value = toText(definition, raw);
        if (!HEX_COLOR.test(value)) throw invalid(definition, 'use un color hexadecimal como #4f46e5.');
        return value.toLowerCase();
      }
      case 'email':
        try {
          return Email.create(toText(definition, raw)).toString();
        } catch {
          throw invalid(definition, 'correo electrónico inválido.');
        }
      case 'url': {
        const value = toText(definition, raw);
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          throw invalid(definition, 'URL inválida.');
        }
        if (url.protocol !== 'https:') throw invalid(definition, 'la URL debe usar https.');
        return value;
      }
      case 'date': {
        const value = toText(definition, raw);
        if (!isValidDay(value)) throw invalid(definition, 'use el formato AAAA-MM-DD.');
        return value;
      }
      case 'text': {
        const value = toText(definition, raw);
        if (definition.pattern && !definition.pattern.test(value)) throw invalid(definition, 'formato inválido.');
        return value;
      }
    }
  },

  /** Parses a stored value leniently: legacy data that does not fit the type is returned as `null`. */
  decode(definition: SettingDefinition, stored: string | null): SettingValue {
    if (stored === null || stored.trim() === '') return definition.type === 'enum-set' ? [] : null;
    const value = stored.trim();
    switch (definition.type) {
      case 'integer':
      case 'decimal': {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      }
      case 'boolean':
        return value === '1' || value.toLowerCase() === 'true';
      case 'enum':
        return definition.options?.includes(value) ? value : null;
      case 'enum-set':
        return value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => definition.options?.includes(item));
      case 'date': {
        const legacy = LEGACY_DAY.exec(value);
        const day = legacy ? `${legacy[3]}-${legacy[2]}-${legacy[1]}` : value.slice(0, 10);
        return isValidDay(day) ? day : null;
      }
      case 'hex-color':
        return HEX_COLOR.test(value) ? value.toLowerCase() : null;
      default:
        return value;
    }
  },

  /** Default stored value of a definition, if any. */
  defaultFor(definition: SettingDefinition, context: SettingDefaultsContext): string | null {
    const fallback = definition.defaultValue;
    if (fallback === undefined) return null;
    return typeof fallback === 'function' ? fallback(context) : fallback;
  },
};
