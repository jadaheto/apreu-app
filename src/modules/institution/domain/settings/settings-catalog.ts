import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import type { SettingDefinition, SettingValue } from './setting-definition.js';

/** Tabs of the configuration screen (legacy `settings.php?tab=`). */
export type SettingsSectionKey =
  'academic' | 'invoice-email' | 'payments' | 'payroll' | 'branding' | 'modules' | 'integrations' | 'ai';

/** Cross-field invariant evaluated on the merged (stored + incoming) values. */
export type SectionRule = (values: ReadonlyMap<string, SettingValue>) => void;

/** Values computed from other keys of the section (stored form). */
export type SectionDerivation = (values: ReadonlyMap<string, SettingValue>) => Record<string, string | null>;

export interface SettingsSectionDefinition {
  key: SettingsSectionKey;
  label: string;
  /** Roles allowed to read and edit the section (superadmin implicit). */
  editors: readonly Role[];
  settings: readonly SettingDefinition[];
  rules?: readonly SectionRule[];
  derive?: SectionDerivation;
}

const money = (key: string, label: string, defaultValue?: string): SettingDefinition => ({
  key,
  label,
  type: 'decimal',
  min: 0,
  max: 9_999_999_999,
  defaultValue,
});

const percentage = (key: string, label: string, defaultValue: string): SettingDefinition => ({
  key,
  label,
  type: 'decimal',
  min: 0,
  max: 100,
  defaultValue,
});

const text = (
  key: string,
  label: string,
  maxLength = 150,
  pattern?: RegExp,
  defaultValue?: string,
): SettingDefinition => ({
  key,
  label,
  type: 'text',
  maxLength,
  pattern,
  defaultValue,
});

const secret = (key: string, label: string): SettingDefinition => ({
  key,
  label,
  type: 'text',
  secret: true,
  maxLength: 500,
});

const HOSTNAME = /^[a-zA-Z0-9.-]{1,253}$/;
const DIGITS = (min: number, max: number) => new RegExp(`^\\d{${min},${max}}$`);

/**
 * Typed catalog of every configurable key, grouped by tab. Keys not listed
 * here cannot be written through the API. Institution identity keys
 * (`school_*`, `rector_name`, `logo`) are owned by the institution profile and
 * deliberately absent. Billing concepts, tuition and WhatsApp templates are
 * tables of other contexts, not settings.
 */
export const SETTINGS_CATALOG: Readonly<Record<SettingsSectionKey, SettingsSectionDefinition>> = {
  academic: {
    key: 'academic',
    label: 'Académico / Costos',
    editors: [Role.ADMIN],
    settings: [
      // Replaces the hard-coded ACADEMIC_YEAR constant (legacy bug B13); an empty value falls back to the current year (B26).
      {
        key: 'academic_year',
        label: 'Año lectivo activo',
        type: 'integer',
        min: 2000,
        max: 2100,
        defaultValue: ({ now }) => String(now.getFullYear()),
      },
      money('costs_matricula', 'Matrícula'),
      money('costs_pension', 'Mensualidad (pensión)'),
      money('costs_certificados', 'Derechos de grado / certificados'),
      money('costs_libros', 'Libros / material educativo'),
    ],
  },
  // DIAN issuer data, software credentials and numbering are owned by the
  // e-invoicing context (`/api/e-invoicing/config`, secrets encrypted at rest);
  // only the mailbox used to deliver invoices lives here.
  'invoice-email': {
    key: 'invoice-email',
    label: 'Correo de facturación',
    editors: [Role.ADMIN, Role.FINANCE],
    settings: [
      text('smtp_host', 'Servidor SMTP de facturas', 253, HOSTNAME),
      { key: 'smtp_port', label: 'Puerto SMTP', type: 'integer', min: 1, max: 65535, defaultValue: '587' },
      { key: 'smtp_encryption', label: 'Cifrado SMTP', type: 'enum', options: ['tls', 'ssl'], defaultValue: 'tls' },
      { ...text('smtp_username', 'Usuario SMTP'), aliases: ['smtp_user'] },
      secret('smtp_password', 'Contraseña SMTP'),
      text('smtp_from_name', 'Nombre del remitente', 100, undefined, 'Facturación Electrónica'),
      { key: 'smtp_from_email', label: 'Correo del remitente', type: 'email' },
      { key: 'email_brand_color', label: 'Color de marca del correo', type: 'hex-color', defaultValue: '#22cbce' },
    ],
  },
  payments: {
    key: 'payments',
    label: 'Medios de pago',
    editors: [Role.ADMIN, Role.FINANCE],
    settings: [
      {
        key: 'payment_methods',
        label: 'Métodos habilitados',
        type: 'enum-set',
        options: ['nequi', 'daviplata', 'breb', 'transferencia', 'efectivo', 'datafono'],
        defaultValue: 'efectivo,transferencia,nequi,daviplata',
      },
      text('nequi_number', 'Número Nequi', 10, DIGITS(10, 10)),
      text('daviplata_number', 'Número Daviplata', 10, DIGITS(10, 10)),
      text('breb_number', 'Llave Bre-B', 100),
      text('bank_name', 'Banco', 100),
      text('bank_account', 'Número de cuenta', 30, /^[0-9-]{4,30}$/),
      {
        key: 'bank_account_type',
        label: 'Tipo de cuenta',
        type: 'enum',
        options: ['ahorros', 'corriente'],
        defaultValue: 'ahorros',
      },
      text('bank_holder', 'Titular'),
    ],
  },
  payroll: {
    key: 'payroll',
    label: 'Nómina',
    editors: [Role.ADMIN, Role.HR],
    settings: [
      money('smlmv', 'Salario mínimo (SMLMV)', '1300000'),
      money('auxilio_transporte', 'Auxilio de transporte', '162000'),
      percentage('rate_health_emp', 'Salud empleado (%)', '4'),
      percentage('rate_pension_emp', 'Pensión empleado (%)', '4'),
      percentage('rate_health_emp_company', 'Salud empresa (%)', '8.5'),
      percentage('rate_pension_company', 'Pensión empresa (%)', '12'),
      percentage('rate_arl', 'ARL (%)', '0.522'),
      percentage('rate_sena', 'SENA (%)', '2'),
      percentage('rate_icbf', 'ICBF (%)', '3'),
      percentage('rate_ccf', 'Caja de compensación (%)', '4'),
    ],
  },
  branding: {
    key: 'branding',
    label: 'Visual / Logo',
    editors: [Role.ADMIN],
    settings: [
      {
        key: 'color_primary',
        label: 'Color primario',
        type: 'hex-color',
        defaultValue: '#4f46e5',
        aliases: ['primary_color'],
      },
      { key: 'color_header_bg', label: 'Fondo del encabezado', type: 'hex-color', defaultValue: '#ffffff' },
      { key: 'color_header_bar', label: 'Barra superior', type: 'hex-color', defaultValue: '#4f46e5' },
      { key: 'logo_size', label: 'Alto del logo (px)', type: 'integer', min: 24, max: 80, defaultValue: '40' },
    ],
  },
  modules: {
    key: 'modules',
    label: 'Módulos del menú',
    editors: [Role.ADMIN],
    settings: [
      // Explicit booleans: an unchecked box is stored as '0' (legacy bug B4).
      { key: 'module_payroll', label: 'Mostrar Nómina', type: 'boolean', defaultValue: '1' },
      { key: 'module_accounting', label: 'Mostrar Contabilidad', type: 'boolean', defaultValue: '1' },
    ],
  },
  integrations: {
    key: 'integrations',
    label: 'WhatsApp y correo general',
    editors: [Role.ADMIN],
    settings: [
      secret('whatsapp_token', 'Token de WhatsApp Cloud API'),
      text('whatsapp_phone_id', 'Phone Number ID', 30, DIGITS(5, 30)),
      text('whatsapp_business_id', 'Business Account ID', 30, DIGITS(5, 30)),
      text('smtp_general_host', 'Servidor SMTP', 253, HOSTNAME, 'smtp.hostinger.com'),
      { key: 'smtp_general_port', label: 'Puerto SMTP', type: 'integer', min: 1, max: 65535, defaultValue: '465' },
      // New key: the legacy mailer forced SSL whatever the port (bug B11).
      {
        key: 'smtp_general_encryption',
        label: 'Cifrado SMTP',
        type: 'enum',
        options: ['ssl', 'tls'],
        defaultValue: 'ssl',
      },
      text('smtp_general_user', 'Usuario SMTP', 150, undefined, 'noreply@apreu.co'),
      secret('smtp_general_password', 'Contraseña SMTP'),
      { key: 'smtp_general_from_email', label: 'Correo remitente', type: 'email', defaultValue: 'noreply@apreu.co' },
      text('smtp_general_from_name', 'Nombre remitente', 100, undefined, 'Apreu ERP'),
    ],
  },
  ai: {
    key: 'ai',
    label: 'Apreu IA',
    editors: [Role.ADMIN],
    settings: [
      // Webhook URLs embed credentials of the n8n workflows: treated as secrets (legacy S8).
      { key: 'n8n_webhook_url', label: 'Webhook del asistente', type: 'url', secret: true, maxLength: 500 },
      { key: 'n8n_marketing_url', label: 'Webhook de marketing', type: 'url', secret: true, maxLength: 500 },
    ],
  },
};

/** Lookup and authorization helpers over {@link SETTINGS_CATALOG}. */
export const SettingsCatalog = {
  section(key: string): SettingsSectionDefinition {
    const section = SETTINGS_CATALOG[key as SettingsSectionKey];
    if (!section) throw new NotFoundError('Sección de configuración', key);
    return section;
  },

  canEdit(role: Role, section: SettingsSectionDefinition): boolean {
    return role === Role.SUPERADMIN || section.editors.includes(role);
  },

  /** The section if the role may read and edit it; 403 otherwise. */
  editableSection(role: Role, key: string): SettingsSectionDefinition {
    const section = SettingsCatalog.section(key);
    if (!SettingsCatalog.canEdit(role, section)) {
      throw new ForbiddenError(`No tiene permisos para la sección de configuración "${section.label}".`);
    }
    return section;
  },

  sectionsFor(role: Role): SettingsSectionDefinition[] {
    return Object.values(SETTINGS_CATALOG).filter((section) => SettingsCatalog.canEdit(role, section));
  },
};
