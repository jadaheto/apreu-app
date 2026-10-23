import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  WHATSAPP_TEMPLATE_REPOSITORY,
  type WhatsAppTemplateRepository,
} from '../../domain/whatsapp/whatsapp-template.repository.js';
import {
  type TemplateStatus,
  WhatsAppTemplate,
  type WhatsAppTemplateData,
} from '../../domain/whatsapp/whatsapp-template.js';
import { toWhatsAppTemplateView, type WhatsAppTemplateView } from '../views.js';

/**
 * CRUD of WhatsApp templates (legacy `whatsapp/templates.php`, duplicated in
 * `settings.php`, bug #24: a single implementation now). Writes are limited
 * to administrators at the HTTP layer (bug #2).
 */
@Injectable()
export class ListWhatsAppTemplatesUseCase implements UseCase<{ status?: TemplateStatus }, WhatsAppTemplateView[]> {
  constructor(@Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository) {}

  async execute({ status }: { status?: TemplateStatus }): Promise<WhatsAppTemplateView[]> {
    return (await this.templates.list(status)).map(toWhatsAppTemplateView);
  }
}

/** Template by id or by name (legacy `whatsapp/get_template.php`, now authenticated: bug #3). */
@Injectable()
export class GetWhatsAppTemplateUseCase implements UseCase<{ id?: number; name?: string }, WhatsAppTemplateView> {
  constructor(@Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository) {}

  async execute({ id, name }: { id?: number; name?: string }): Promise<WhatsAppTemplateView> {
    const template = id !== undefined ? await this.templates.findById(id) : await this.templates.findByName(name ?? '');
    if (!template) throw new NotFoundError('Plantilla de WhatsApp', id ?? name ?? '');
    return toWhatsAppTemplateView(template);
  }
}

/** Creates a template; the name is unique (RN-COM-14). */
@Injectable()
export class CreateWhatsAppTemplateUseCase implements UseCase<WhatsAppTemplateData, WhatsAppTemplateView> {
  constructor(@Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository) {}

  async execute(data: WhatsAppTemplateData): Promise<WhatsAppTemplateView> {
    const template = WhatsAppTemplate.create(data);
    if (await this.templates.findByName(template.name)) {
      throw new ConflictError(`Ya existe una plantilla llamada "${template.name}".`);
    }
    await this.templates.save(template);
    return toWhatsAppTemplateView(template);
  }
}

/** Replaces the attributes of a template keeping the name unique. */
@Injectable()
export class UpdateWhatsAppTemplateUseCase implements UseCase<
  { id: number; data: WhatsAppTemplateData },
  WhatsAppTemplateView
> {
  constructor(@Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository) {}

  async execute({ id, data }: { id: number; data: WhatsAppTemplateData }): Promise<WhatsAppTemplateView> {
    const template = await this.templates.findById(id);
    if (!template) throw new NotFoundError('Plantilla de WhatsApp', id);
    template.update(data);
    const homonym = await this.templates.findByName(template.name);
    if (homonym && homonym.id !== id) {
      throw new ConflictError(`Ya existe una plantilla llamada "${template.name}".`);
    }
    await this.templates.save(template);
    return toWhatsAppTemplateView(template);
  }
}

/** Deletes a template. Its past log entries keep the template name. */
@Injectable()
export class DeleteWhatsAppTemplateUseCase implements UseCase<number, void> {
  constructor(@Inject(WHATSAPP_TEMPLATE_REPOSITORY) private readonly templates: WhatsAppTemplateRepository) {}

  async execute(id: number): Promise<void> {
    if (!(await this.templates.findById(id))) throw new NotFoundError('Plantilla de WhatsApp', id);
    await this.templates.delete(id);
  }
}
