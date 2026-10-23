import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Calendar } from '../domain/calendar.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { toChargeView, type ChargeView } from './views.js';

/** Cancels a pending charge without payments (state `cancelled`, not implemented in legacy, bug B52). */
@Injectable()
export class CancelChargeUseCase implements UseCase<{ chargeId: number }, ChargeView> {
  constructor(
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ chargeId }: { chargeId: number }): Promise<ChargeView> {
    const charge = await this.uow.runInTransaction(async () => {
      const found = await this.charges.findById(chargeId, { forUpdate: true });
      if (!found) throw new NotFoundError('Cargo', chargeId);
      found.cancel();
      await this.charges.save(found);
      return found;
    });
    return toChargeView(charge, Calendar.today(this.clock.now()));
  }
}
