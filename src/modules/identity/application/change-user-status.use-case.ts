import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { UserAdministrationPolicy, type UserAdministrator } from '../domain/user-administration-policy.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import type { ManagedUserView } from './managed-user-view.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';

export interface ChangeUserStatusInput {
  actor: UserAdministrator;
  userId: number;
  active: boolean;
}

/** Payload of `identity.user-status-changed`. */
export interface UserStatusChangedPayload {
  userId: number;
  isActive: boolean;
}

/**
 * Activates or deactivates an account (legacy `toggle_status`, now with an
 * explicit target state so retries are idempotent). A deactivated user can no
 * longer sign in, refresh the session or read `/auth/me`. Deactivation
 * replaces the legacy physical delete, which destroyed audit links.
 */
@Injectable()
export class ChangeUserStatusUseCase implements UseCase<ChangeUserStatusInput, ManagedUserView> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly views: ManagedUserViewBuilder,
  ) {}

  async execute({ actor, userId, active }: ChangeUserStatusInput): Promise<ManagedUserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario', userId);
    UserAdministrationPolicy.assertCanManage(actor, user);
    UserAdministrationPolicy.assertCanChangeStatus(actor, user, active);

    if (user.isActive !== active) {
      if (active) user.activate();
      else user.deactivate();
      await this.users.save(user);
      const payload: UserStatusChangedPayload = { userId, isActive: active };
      await this.events.publish({
        name: 'identity.user-status-changed',
        occurredAt: this.clock.now(),
        payload: { ...payload },
      });
    }
    return this.views.one(user);
  }
}
