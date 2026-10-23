import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  EMPLOYEE_STICKER_REPOSITORY,
  type EmployeeStickerRepository,
} from '../../domain/stickers/employee-sticker.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';
import { toStickerView, type StickerView } from './sticker-view.js';

export interface MarkStickerReadInput {
  actor: AuthenticatedActor;
  stickerId: number;
}

/** Marks a sticker as read; only its recipient or admin/HR (fixes `mark_read.php` IDOR, S13). */
@Injectable()
export class MarkStickerReadUseCase implements UseCase<MarkStickerReadInput, StickerView> {
  constructor(
    @Inject(EMPLOYEE_STICKER_REPOSITORY) private readonly stickers: EmployeeStickerRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, stickerId }: MarkStickerReadInput): Promise<StickerView> {
    const sticker = await this.stickers.findById(stickerId);
    const allowed =
      sticker !== null && (isHrManager(actor) || (await this.currentEmployee.find(actor))?.id === sticker.employeeId);
    if (!sticker || !allowed) throw new NotFoundError('Sticker', stickerId);
    sticker.markRead(this.clock.now());
    await this.stickers.save(sticker);
    return toStickerView(sticker);
  }
}
