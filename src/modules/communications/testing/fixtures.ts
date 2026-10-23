import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { Role } from '../../../shared/domain/role.js';
import { WhatsAppTemplate, type WhatsAppTemplateData } from '../domain/whatsapp/whatsapp-template.js';

export const actor = (overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor => ({
  userId: 1,
  role: Role.ADMIN,
  email: 'director@colegio.co',
  name: 'Directora',
  tenant: 'colegio-a',
  ...overrides,
});

export const templateData = (overrides: Partial<WhatsAppTemplateData> = {}): WhatsAppTemplateData => ({
  name: 'cobro_mensual',
  metaTemplateId: null,
  language: 'es_CO',
  category: 'utility',
  body: 'Hola {{1}}, debe {{2}}.',
  variables: ['nombre', 'monto'],
  status: 'active',
  headerType: 'none',
  headerText: null,
  headerImageUrl: null,
  footerText: null,
  buttons: [],
  ...overrides,
});

/** Active template with `count` placeholders. */
export const templateWith = (name: string, count: number, overrides: Partial<WhatsAppTemplateData> = {}) =>
  WhatsAppTemplate.create(
    templateData({
      name,
      body: Array.from({ length: count }, (_, i) => `{{${i + 1}}}`).join(' - '),
      variables: Array.from({ length: count }, (_, i) => `v${i + 1}`),
      ...overrides,
    }),
  );
