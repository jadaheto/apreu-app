import { BusinessRuleViolationError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import type { WhatsAppTemplateRepository } from '../../domain/whatsapp/whatsapp-template.repository.js';
import type { WhatsAppTemplate } from '../../domain/whatsapp/whatsapp-template.js';

/**
 * Loads a template by name and checks, before any message is sent, that it
 * is active and expects exactly `variableCount` variables. Bulk sends thus
 * fail fast instead of logging hundreds of identical failures.
 */
export const requireUsableTemplate = async (
  templates: WhatsAppTemplateRepository,
  name: string,
  variableCount?: number,
): Promise<WhatsAppTemplate> => {
  const template = await templates.findByName(name);
  if (!template) throw new NotFoundError('Plantilla de WhatsApp', name);
  if (!template.isActive) {
    throw new BusinessRuleViolationError(`La plantilla "${name}" no está activa.`, 'TEMPLATE_NOT_ACTIVE');
  }
  if (variableCount !== undefined && template.placeholderCount !== variableCount) {
    throw new BusinessRuleViolationError(
      `La plantilla "${name}" debe tener ${variableCount} variable(s) y tiene ${template.placeholderCount}.`,
      'TEMPLATE_VARIABLES_MISMATCH',
    );
  }
  return template;
};
