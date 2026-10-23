import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import {
  EMPLOYEE_STICKER_REPOSITORY,
  type EmployeeStickerRepository,
  type StickerFilter,
} from '../../domain/stickers/employee-sticker.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { stickerScopeFor } from './sticker-scope.js';
import { StickerViewAssembler } from './sticker-view.assembler.js';
import type { StickerView } from './sticker-view.js';

export interface ListStickersInput {
  actor: AuthenticatedActor;
  filter: StickerFilter;
  employeeId?: number;
  page: PageRequest;
}

/** Sticker board (legacy `stickers/index.php`) with visibility by role. */
@Injectable()
export class ListStickersUseCase implements UseCase<ListStickersInput, Paginated<StickerView>> {
  constructor(
    @Inject(EMPLOYEE_STICKER_REPOSITORY) private readonly stickers: EmployeeStickerRepository,
    private readonly currentEmployee: CurrentEmployeeResolver,
    private readonly assembler: StickerViewAssembler,
  ) {}

  async execute({ actor, filter, employeeId, page }: ListStickersInput): Promise<Paginated<StickerView>> {
    const scope = await stickerScopeFor(actor, this.currentEmployee);
    const result = await this.stickers.search({ filter, employeeId, scope }, page);
    return { ...result, items: await this.assembler.toViews(result.items) };
  }
}
