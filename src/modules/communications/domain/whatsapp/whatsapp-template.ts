import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';

export const TEMPLATE_CATEGORIES = ['utility', 'marketing', 'authentication'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_STATUSES = ['active', 'pending', 'rejected'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const HEADER_TYPES = ['none', 'text', 'image'] as const;
export type HeaderType = (typeof HEADER_TYPES)[number];

/** Template names used by the built-in flows (seeded in `schema.sql`). */
export const BUILT_IN_TEMPLATES = {
  billing: 'cobro_mensual',
  paymentConfirmation: 'pago_confirmado',
  event: 'evento_colegio',
} as const;

const NAME_PATTERN = /^[a-z0-9_]{1,100}$/;
const LANGUAGE_PATTERN = /^[a-z]{2}(_[A-Z]{2})?$/;
const PLACEHOLDER_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;
export const MAX_BODY_LENGTH = 1024;
const MAX_BUTTONS = 10;

/** Static button definition as stored in `whatsapp_templates.buttons` (JSON). */
export type TemplateButton = Record<string, unknown>;

export interface WhatsAppTemplateProps {
  name: string;
  metaTemplateId: string | null;
  language: string;
  category: TemplateCategory;
  body: string;
  /** Labels of the positional placeholders `{{1}}..{{n}}`. */
  variables: string[];
  status: TemplateStatus;
  headerType: HeaderType;
  headerText: string | null;
  headerImageUrl: string | null;
  footerText: string | null;
  buttons: TemplateButton[];
  createdAt: Date | null;
}

export type WhatsAppTemplateData = Omit<WhatsAppTemplateProps, 'createdAt'>;

/** Parameters ready to be sent to Meta for one message. */
export interface ComposedTemplateMessage {
  name: string;
  language: string;
  bodyParameters: string[];
  headerImageUrl: string | null;
}

/**
 * Message template approved by Meta (`whatsapp_templates`, RN-COM-14).
 *
 * Fixes of the legacy implementation: the template's own language is used
 * (bug #10, it was always `es_MX`), image headers are sent as a component,
 * the number of variable labels must match the placeholders, and only
 * administrators manage templates (bug #2).
 */
export class WhatsAppTemplate extends Entity<WhatsAppTemplateProps> {
  private constructor(id: EntityId, props: WhatsAppTemplateProps) {
    super(id, props);
  }

  static create(data: WhatsAppTemplateData): WhatsAppTemplate {
    return new WhatsAppTemplate(null, { ...WhatsAppTemplate.validated(data), createdAt: null });
  }

  /** Rebuilds a persisted template; legacy rows are not re-validated. */
  static restore(id: number, props: WhatsAppTemplateProps): WhatsAppTemplate {
    return new WhatsAppTemplate(id, { ...props, variables: [...props.variables], buttons: [...props.buttons] });
  }

  /** Replaces every editable attribute enforcing the creation rules. */
  update(data: WhatsAppTemplateData): void {
    Object.assign(this.props, WhatsAppTemplate.validated(data));
  }

  /** Number of positional placeholders in the body. */
  get placeholderCount(): number {
    return WhatsAppTemplate.countPlaceholders(this.props.body);
  }

  get isActive(): boolean {
    return this.props.status === 'active';
  }

  /**
   * Builds the parameters of a message. Values are collapsed to one line
   * because Meta rejects parameters with new lines or tabs.
   */
  compose(values: readonly string[]): ComposedTemplateMessage {
    if (!this.isActive) {
      throw new BusinessRuleViolationError(`La plantilla "${this.name}" no está activa.`, 'TEMPLATE_NOT_ACTIVE');
    }
    const expected = this.placeholderCount;
    const parameters = values.map((value) =>
      String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    if (parameters.length !== expected || parameters.some((value) => value === '')) {
      throw new BusinessRuleViolationError(
        `La plantilla "${this.name}" requiere ${expected} variable(s) no vacías.`,
        'TEMPLATE_VARIABLES_MISMATCH',
        { expected, received: parameters.length },
      );
    }
    return {
      name: this.name,
      language: this.language,
      bodyParameters: parameters,
      headerImageUrl: this.props.headerType === 'image' ? this.props.headerImageUrl : null,
    };
  }

  /** Body with the placeholders replaced, for previews and logs. */
  render(values: readonly string[]): string {
    return this.props.body.replace(PLACEHOLDER_PATTERN, (match, index: string) => values[Number(index) - 1] ?? match);
  }

  get name(): string {
    return this.props.name;
  }
  get metaTemplateId(): string | null {
    return this.props.metaTemplateId;
  }
  get language(): string {
    return this.props.language;
  }
  get category(): TemplateCategory {
    return this.props.category;
  }
  get body(): string {
    return this.props.body;
  }
  get variables(): readonly string[] {
    return this.props.variables;
  }
  get status(): TemplateStatus {
    return this.props.status;
  }
  get headerType(): HeaderType {
    return this.props.headerType;
  }
  get headerText(): string | null {
    return this.props.headerText;
  }
  get headerImageUrl(): string | null {
    return this.props.headerImageUrl;
  }
  get footerText(): string | null {
    return this.props.footerText;
  }
  get buttons(): readonly TemplateButton[] {
    return this.props.buttons;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  static countPlaceholders(body: string): number {
    const indexes = new Set([...body.matchAll(PLACEHOLDER_PATTERN)].map((match) => Number(match[1])));
    return indexes.size;
  }

  private static validated(data: WhatsAppTemplateData): WhatsAppTemplateData {
    const name = data.name?.trim() ?? '';
    if (!NAME_PATTERN.test(name)) {
      throw new BusinessRuleViolationError(
        'El nombre de la plantilla solo admite minúsculas, números y guion bajo (máx. 100).',
        'INVALID_TEMPLATE_NAME',
      );
    }
    if (!LANGUAGE_PATTERN.test(data.language ?? '')) {
      throw new BusinessRuleViolationError('Código de idioma inválido (ej. es_CO).', 'INVALID_LANGUAGE');
    }
    Guard.oneOf(data.category, TEMPLATE_CATEGORIES, 'categoría');
    Guard.oneOf(data.status, TEMPLATE_STATUSES, 'estado');
    Guard.oneOf(data.headerType, HEADER_TYPES, 'tipo de encabezado');

    const body = data.body?.trim() ?? '';
    Guard.againstEmpty(body, 'cuerpo');
    Guard.againstMaxLength(body, MAX_BODY_LENGTH, 'cuerpo');
    WhatsAppTemplate.assertConsecutivePlaceholders(body);

    const variables = data.variables.map((label) => label.trim());
    if (variables.length !== WhatsAppTemplate.countPlaceholders(body) || variables.some((label) => !label)) {
      throw new BusinessRuleViolationError(
        'Debe indicar una etiqueta por cada variable {{n}} del cuerpo.',
        'TEMPLATE_VARIABLES_MISMATCH',
      );
    }

    const headerText = data.headerType === 'text' ? (data.headerText?.trim() ?? '') : null;
    if (headerText !== null) {
      Guard.againstEmpty(headerText, 'texto del encabezado');
      Guard.againstMaxLength(headerText, 60, 'texto del encabezado');
    }
    const headerImageUrl = data.headerType === 'image' ? (data.headerImageUrl?.trim() ?? '') : null;
    if (headerImageUrl !== null && !/^https:\/\/\S+$/.test(headerImageUrl)) {
      throw new BusinessRuleViolationError('El encabezado de imagen requiere una URL https.', 'INVALID_HEADER_IMAGE');
    }
    const footerText = data.footerText?.trim() || null;
    Guard.againstMaxLength(footerText, 60, 'pie de página');

    if (data.buttons.length > MAX_BUTTONS || data.buttons.some((button) => typeof button !== 'object' || !button)) {
      throw new BusinessRuleViolationError(`Máximo ${MAX_BUTTONS} botones válidos.`, 'INVALID_BUTTONS');
    }

    const metaTemplateId = data.metaTemplateId?.trim() || null;
    Guard.againstMaxLength(metaTemplateId, 100, 'ID de plantilla en Meta');

    return {
      name,
      metaTemplateId,
      language: data.language,
      category: data.category,
      body,
      variables,
      status: data.status,
      headerType: data.headerType,
      headerText,
      headerImageUrl,
      footerText,
      buttons: [...data.buttons],
    };
  }

  private static assertConsecutivePlaceholders(body: string): void {
    const indexes = [...new Set([...body.matchAll(PLACEHOLDER_PATTERN)].map((match) => Number(match[1])))].sort(
      (a, b) => a - b,
    );
    if (indexes.some((value, position) => value !== position + 1)) {
      throw new BusinessRuleViolationError(
        'Las variables deben numerarse de forma consecutiva desde {{1}}.',
        'INVALID_PLACEHOLDERS',
      );
    }
  }
}
