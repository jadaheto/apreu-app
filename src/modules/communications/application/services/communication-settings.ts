import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import {
  assertDeliveryPolicy,
  DEFAULT_EMAIL_POLICY,
  DEFAULT_WHATSAPP_POLICY,
  type DeliveryPolicy,
} from '../../domain/common/delivery-policy.js';
import type { AiEndpoint } from '../ports/ai-gateway.port.js';
import type { SmtpSecurity, SmtpSettings } from '../ports/email-sender.port.js';
import { SETTINGS_STORE, type SettingsStorePort } from '../ports/settings-store.port.js';
import type { WhatsAppCredentials } from '../ports/whatsapp-gateway.port.js';

/**
 * Which SMTP account to use: `general` (notices, billing, `smtp_general_*`)
 * or `invoicing` (electronic invoices, `smtp_*` of the DIAN tab, falling back
 * to `general` when incomplete).
 */
export type SmtpProfile = 'general' | 'invoicing';

export type EmailImageKind = 'logo' | 'promo';

export interface WhatsAppConfiguration {
  /** `null` when token or phone id are missing (RN-COM-12). */
  credentials: WhatsAppCredentials | null;
  appSecret: string | null;
  verifyToken: string | null;
}

export interface AiConfiguration {
  chat: AiEndpoint | null;
  marketing: AiEndpoint | null;
}

export interface Branding {
  schoolName: string;
  /** Validated `#rrggbb` color (prevents CSS injection in templates). */
  primaryColor: string;
  invoiceBrandColor: string;
  logoPath: string | null;
  promoPath: string | null;
  businessName: string;
  nit: string;
  resolutionNumber: string;
}

/** Platform defaults (RN-COM-01, legacy `config/mailer.php`). */
const SMTP_DEFAULTS = {
  host: 'smtp.hostinger.com',
  port: 465,
  user: 'noreply@apreu.co',
  fromEmail: 'noreply@apreu.co',
  fromName: 'Apreu ERP',
};

const SMTP_KEYS = {
  general: {
    host: 'smtp_general_host',
    port: 'smtp_general_port',
    security: 'smtp_general_encryption',
    user: 'smtp_general_user',
    password: 'smtp_general_password',
    fromEmail: 'smtp_general_from_email',
    fromName: 'smtp_general_from_name',
  },
  invoicing: {
    host: 'smtp_host',
    port: 'smtp_port',
    security: 'smtp_encryption',
    user: 'smtp_username',
    password: 'smtp_password',
    fromEmail: 'smtp_from_email',
    fromName: 'smtp_from_name',
  },
} as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Typed, validated view of the communication settings stored in the
 * tenant `settings` table. Secrets are only handed to the adapters, never
 * returned to the HTTP layer (legacy bug #25).
 */
@Injectable()
export class CommunicationSettings {
  constructor(@Inject(SETTINGS_STORE) private readonly store: SettingsStorePort) {}

  /** SMTP account for the profile, or `null` when no password is configured. */
  async smtp(profile: SmtpProfile): Promise<SmtpSettings | null> {
    if (profile === 'invoicing') {
      const invoicing = await this.readSmtp('invoicing', false);
      if (invoicing) return invoicing;
    }
    return this.readSmtp('general', true);
  }

  /** Like {@link smtp} but fails with a business error when not configured. */
  async requireSmtp(profile: SmtpProfile): Promise<SmtpSettings> {
    const account = await this.smtp(profile);
    if (!account) {
      throw new BusinessRuleViolationError(
        'El correo SMTP no está configurado. Ve a Configuración → Correo.',
        'SMTP_NOT_CONFIGURED',
      );
    }
    return account;
  }

  async whatsapp(): Promise<WhatsAppConfiguration> {
    const s = await this.store.read([
      'whatsapp_token',
      'whatsapp_phone_id',
      'whatsapp_app_secret',
      'whatsapp_webhook_verify_token',
    ]);
    const token = clean(s.whatsapp_token);
    const phoneNumberId = clean(s.whatsapp_phone_id);
    return {
      credentials: token && phoneNumberId ? { token, phoneNumberId } : null,
      appSecret: clean(s.whatsapp_app_secret),
      verifyToken: clean(s.whatsapp_webhook_verify_token),
    };
  }

  /** WhatsApp credentials or a business error (RN-COM-12). */
  async requireWhatsApp(): Promise<WhatsAppCredentials> {
    const { credentials } = await this.whatsapp();
    if (!credentials) {
      throw new BusinessRuleViolationError(
        'WhatsApp no configurado. Configure Token y Phone ID en Ajustes.',
        'WHATSAPP_NOT_CONFIGURED',
      );
    }
    return credentials;
  }

  async ai(): Promise<AiConfiguration> {
    const s = await this.store.read(['n8n_webhook_url', 'n8n_marketing_url', 'n8n_auth_token']);
    const authToken = clean(s.n8n_auth_token);
    const endpoint = (url: string | null): AiEndpoint | null => (url && isHttpUrl(url) ? { url, authToken } : null);
    return { chat: endpoint(clean(s.n8n_webhook_url)), marketing: endpoint(clean(s.n8n_marketing_url)) };
  }

  async branding(): Promise<Branding> {
    const s = await this.store.read([
      'school_name',
      'primary_color',
      'email_brand_color',
      'email_logo_path',
      'email_promo_path',
      'dian_business_name',
      'dian_nit',
      'dian_resolution_number',
    ]);
    const schoolName = clean(s.school_name) ?? 'Institución Educativa Apreu';
    return {
      schoolName,
      primaryColor: color(s.primary_color, '#4f46e5'),
      invoiceBrandColor: color(s.email_brand_color, '#059669'),
      logoPath: clean(s.email_logo_path),
      promoPath: clean(s.email_promo_path),
      businessName: clean(s.dian_business_name) ?? schoolName,
      nit: clean(s.dian_nit) ?? '',
      resolutionNumber: clean(s.dian_resolution_number) ?? '',
    };
  }

  /** Batch size and pause for bulk deliveries; invalid values fall back to the defaults. */
  async deliveryPolicy(channel: 'email' | 'whatsapp'): Promise<DeliveryPolicy> {
    const fallback = channel === 'email' ? DEFAULT_EMAIL_POLICY : DEFAULT_WHATSAPP_POLICY;
    const s = await this.store.read([`${channel}_batch_size`, `${channel}_batch_pause_ms`]);
    const policy = {
      batchSize: integer(s[`${channel}_batch_size`]) ?? fallback.batchSize,
      pauseMs: integer(s[`${channel}_batch_pause_ms`]) ?? fallback.pauseMs,
    };
    try {
      assertDeliveryPolicy(policy);
      return policy;
    } catch {
      return fallback;
    }
  }

  async saveEmailImagePath(kind: EmailImageKind, path: string): Promise<void> {
    await this.store.write(kind === 'logo' ? 'email_logo_path' : 'email_promo_path', path);
  }

  private async readSmtp(profile: SmtpProfile, withDefaults: boolean): Promise<SmtpSettings | null> {
    const keys = SMTP_KEYS[profile];
    const s = await this.store.read(Object.values(keys));
    const pick = (key: string, fallback: string): string | null => clean(s[key]) ?? (withDefaults ? fallback : null);

    const host = pick(keys.host, SMTP_DEFAULTS.host);
    const username = pick(keys.user, SMTP_DEFAULTS.user);
    const password = clean(s[keys.password]);
    if (!host || !username || !password) return null;

    const port = integer(s[keys.port]) ?? SMTP_DEFAULTS.port;
    const fromEmail = clean(s[keys.fromEmail]) ?? (withDefaults ? SMTP_DEFAULTS.fromEmail : username);
    return {
      host,
      port,
      security: securityFor(clean(s[keys.security]), port),
      username,
      password,
      fromEmail,
      fromName: clean(s[keys.fromName]) ?? SMTP_DEFAULTS.fromName,
    };
  }
}

const clean = (value: string | undefined): string | null => value?.trim() || null;

const integer = (value: string | undefined): number | null => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const color = (value: string | undefined, fallback: string): string => {
  const candidate = clean(value);
  return candidate && HEX_COLOR.test(candidate) ? candidate : fallback;
};

const isHttpUrl = (value: string): boolean => /^https?:\/\/[^\s]+$/i.test(value);

/**
 * Explicit setting wins; otherwise port 465 means implicit TLS and any other
 * port STARTTLS (legacy bug #8 forced SSL even on port 587).
 */
const securityFor = (configured: string | null, port: number): SmtpSecurity => {
  const normalized = configured?.toLowerCase();
  if (normalized === 'ssl' || (normalized === 'tls' && port === 465)) return 'ssl';
  if (normalized === 'starttls' || normalized === 'tls') return 'starttls';
  if (normalized === 'none') return 'none';
  return port === 465 ? 'ssl' : 'starttls';
};
