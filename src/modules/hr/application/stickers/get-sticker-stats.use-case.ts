import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  EMPLOYEE_STICKER_REPOSITORY,
  type EmployeeStickerRepository,
  type StickerStats,
} from '../../domain/stickers/employee-sticker.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { stickerScopeFor } from './sticker-scope.js';

/** Total, unread and urgent-unread counters within the actor's visibility. */
@Injectable()
export class GetStickerStatsUseCase implements UseCase<AuthenticatedActor, StickerStats> {
  constructor(
    @Inject(EMPLOYEE_STICKER_REPOSITORY) private readonly stickers: EmployeeStickerRepository,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute(actor: AuthenticatedActor): Promise<StickerStats> {
    return this.stickers.stats(await stickerScopeFor(actor, this.currentEmployee));
  }
}
