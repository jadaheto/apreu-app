import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENVIRONMENT, type Environment } from '../config/environment.js';
import { TenantDataSource } from '../persistence/tenant-data-source.js';
import { TenantContext } from '../tenancy/tenant-context.js';

/** Visual identity of the school printed on generated documents. */
export interface DocumentBranding {
  /** `institutions.name` (fallback `settings.school_name`), for documents without their own institution data. */
  institutionName: string | null;
  /** `institutions.nit` (fallback `settings.school_nit`). */
  nit: string | null;
  /** Logo as a PNG/JPEG data URL (the formats PDF supports), or `null`. */
  logo: string | null;
  /** `#rrggbb` used for headings, rules and table headers. */
  primaryColor: string;
  /** Contact line items (address, city, phone, e-mail) when registered. */
  contact: string[];
}

/** Kind of verifiable document, used in the QR URL (`{kind}`). */
export type VerifiableDocumentKind = 'estudiantil' | 'laboral';

export const DEFAULT_BRAND_COLOR = '#47557c';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const SETTING_KEYS = ['color_primary', 'primary_color', 'school_name', 'school_nit'];

interface InstitutionRow {
  name: string | null;
  nit: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
}

const mimeOf = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null; // WebP/SVG are not embeddable in PDF: the header falls back to text only.
};

/**
 * Reads the branding of the current school for document adapters (report
 * cards, certificates, payslips, accounting reports): the logo uploaded in
 * the institution profile (`institutions.logo`, stored under
 * `<UPLOADS_DIR>/<tenant>/`), the primary color (`settings.color_primary`)
 * and contact data.
 *
 * Shared kernel infrastructure: it only reads, and it never fails a
 * document: any problem falls back to an unbranded header.
 */
@Injectable()
export class DocumentBrandingProvider {
  private readonly logger = new Logger(DocumentBrandingProvider.name);

  constructor(
    private readonly db: TenantDataSource,
    private readonly tenantContext: TenantContext,
    @Inject(ENVIRONMENT) private readonly env: Pick<Environment, 'storage' | 'documentVerifyUrlTemplate'>,
  ) {}

  async load(): Promise<DocumentBranding> {
    try {
      const manager = await this.db.manager();
      const [institutions, settings]: [InstitutionRow[], { key: string; value: string | null }[]] = await Promise.all([
        manager.query('SELECT name, nit, address, city, phone, email, logo FROM institutions ORDER BY id LIMIT 1'),
        manager.query('SELECT key, value FROM settings WHERE key = ANY($1)', [SETTING_KEYS]),
      ]);
      const institution = institutions[0];
      const values = new Map(settings.map((row) => [row.key, row.value?.trim() ?? '']));
      const color = [values.get('color_primary'), values.get('primary_color')].find((c) => c && HEX_COLOR.test(c));
      return {
        institutionName: institution?.name?.trim() || values.get('school_name') || null,
        nit: institution?.nit?.trim() || values.get('school_nit') || null,
        logo: institution?.logo ? await this.logoDataUrl(institution.logo) : null,
        primaryColor: color ?? DEFAULT_BRAND_COLOR,
        contact: [institution?.address, institution?.city, institution?.phone, institution?.email]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      };
    } catch (error) {
      this.logger.warn(`No se pudo leer la identidad visual del colegio: ${(error as Error).message}`);
      return { institutionName: null, nit: null, logo: null, primaryColor: DEFAULT_BRAND_COLOR, contact: [] };
    }
  }

  /** Content of the verification QR: the public URL when configured, else the code itself. */
  verificationTarget(kind: VerifiableDocumentKind, code: string): string {
    const template = this.env.documentVerifyUrlTemplate;
    if (!template) return code;
    return template
      .replaceAll('{tenant}', encodeURIComponent(this.tenantContext.current()?.slug ?? ''))
      .replaceAll('{kind}', kind)
      .replaceAll('{code}', encodeURIComponent(code));
  }

  private async logoDataUrl(key: string): Promise<string | null> {
    const tenantRoot = resolve(this.env.storage.uploadsDir, this.tenantContext.require().slug);
    const path = resolve(tenantRoot, key);
    if (!SAFE_KEY.test(key) || key.includes('..') || !path.startsWith(tenantRoot + sep)) return null;
    try {
      const bytes = await readFile(path);
      const mime = bytes.length <= MAX_LOGO_BYTES ? mimeOf(bytes) : null;
      return mime ? `data:${mime};base64,${bytes.toString('base64')}` : null;
    } catch {
      return null;
    }
  }
}
