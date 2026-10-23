import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  EMPLOYEE_STICKER_REPOSITORY,
  type EmployeeStickerRepository,
} from '../../domain/stickers/employee-sticker.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { StickerViewAssembler } from './sticker-view.assembler.js';
import type { StickerView } from './sticker-view.js';

/** Maximum stickers shown by the portal pop-up (legacy `includes/footer.php`). */
export const PENDING_STICKERS_LIMIT = 5;

/**
 * Unread stickers of the signed-in employee for the pop-up, urgent first.
 * Linked by `user_id` instead of e-mail (B24); users without employee record get none.
 */
@Injectable()
export class ListMyPendingStickersUseCase implements UseCase<AuthenticatedActor, StickerView[]> {
  constructor(
    @Inject(EMPLOYEE_STICKER_REPOSITORY) private readonly stickers: EmployeeStickerRepository,
    private readonly currentEmployee: CurrentEmployeeResolver,
    private readonly assembler: StickerViewAssembler,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<StickerView[]> {
    const own = await this.currentEmployee.find(actor);
    if (!own) return [];
    return this.assembler.toViews(await this.stickers.pendingFor(own.id as number, PENDING_STICKERS_LIMIT));
  }
}
