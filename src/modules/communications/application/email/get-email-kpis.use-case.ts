import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  EMAIL_LOG_REPOSITORY,
  type EmailKpis,
  type EmailLogRepository,
} from '../../domain/email/email-log.repository.js';

/** Totals of the e-mail dashboard: sent, notices, billing, DIAN and failed (legacy `email/index.php`). */
@Injectable()
export class GetEmailKpisUseCase implements UseCase<void, EmailKpis> {
  constructor(@Inject(EMAIL_LOG_REPOSITORY) private readonly logs: EmailLogRepository) {}

  execute(): Promise<EmailKpis> {
    return this.logs.kpis();
  }
}
