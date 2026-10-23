import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  EMPLOYEE_STICKER_REPOSITORY,
  type EmployeeStickerRepository,
} from '../../domain/stickers/employee-sticker.repository.js';
import { isHrManager } from '../hr-access.js';

export interface DeleteStickerInput {
  actor: AuthenticatedActor;
  stickerId: number;
}

/** Deletes a sticker; only its author or admin/HR (fixes the legacy IDOR, S13). */
@Injectable()
export class DeleteStickerUseCase implements UseCase<DeleteStickerInput, void> {
  constructor(@Inject(EMPLOYEE_STICKER_REPOSITORY) private readonly stickers: EmployeeStickerRepository) {}

  async execute({ actor, stickerId }: DeleteStickerInput): Promise<void> {
    const sticker = await this.stickers.findById(stickerId);
    if (!sticker || !(isHrManager(actor) || sticker.createdBy === actor.userId)) {
      throw new NotFoundError('Sticker', stickerId);
    }
    await this.stickers.delete(stickerId);
  }
}
