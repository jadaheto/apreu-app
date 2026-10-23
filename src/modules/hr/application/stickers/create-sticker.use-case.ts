import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError, ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { EmployeeSticker, type StickerColor, type StickerPriority } from '../../domain/stickers/employee-sticker.js';
import {
  EMPLOYEE_STICKER_REPOSITORY,
  type EmployeeStickerRepository,
} from '../../domain/stickers/employee-sticker.repository.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';
import { toStickerView, type StickerView } from './sticker-view.js';

export interface CreateStickerInput {
  actor: AuthenticatedActor;
  employeeId: number;
  title: string;
  content?: string | null;
  color?: StickerColor;
  priority?: StickerPriority;
}

/**
 * Assigns a sticker. Admin/HR to any employee with portal access; any other
 * staff member only to themselves (fixes the legacy IDOR S13 where a teacher
 * could post to any `employee_id`).
 */
@Injectable()
export class CreateStickerUseCase implements UseCase<CreateStickerInput, StickerView> {
  constructor(
    @Inject(EMPLOYEE_STICKER_REPOSITORY) private readonly stickers: EmployeeStickerRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute(input: CreateStickerInput): Promise<StickerView> {
    const { actor } = input;
    if (!isHrManager(actor)) {
      const own = await this.currentEmployee.require(actor);
      if (own.id !== input.employeeId) throw new ForbiddenError('Solo puede crear stickers para usted mismo.');
    }
    const employee = await this.employees.findById(input.employeeId);
    if (!employee) throw new NotFoundError('Empleado', input.employeeId);
    if (!employee.hasPortalAccess) {
      throw new BusinessRuleViolationError('El empleado no está activo.', 'EMPLOYEE_NOT_ACTIVE');
    }
    const sticker = EmployeeSticker.create({ ...input, createdBy: actor.userId });
    await this.stickers.save(sticker);
    return toStickerView(sticker, employee.fullName, actor.name);
  }
}
