import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../shared/domain/domain-error.js';
import type { Role } from '../../../shared/domain/role.js';
import { Email } from '../../../shared/domain/value-objects/email.vo.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../../../shared/application/ports/password-hasher.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { UserAdministrationPolicy, type UserAdministrator } from '../domain/user-administration-policy.js';
import { User } from '../domain/user.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';
import type { UserWithTemporaryPassword } from './managed-user-view.js';
import {
  TEMPORARY_PASSWORD_GENERATOR,
  type TemporaryPasswordGeneratorPort,
} from './ports/temporary-password-generator.port.js';

export interface CreateUserInput {
  actor: UserAdministrator;
  name: string;
  email: string;
  role: Role;
}

/** Payload of `identity.user-created`. */
export interface UserCreatedPayload {
  userId: number;
  name: string;
  email: string;
  role: Role;
}

/**
 * Creates an account with a random temporary password that must be changed
 * at first sign-in (legacy `admin/users.php` action `create`, which let the
 * admin type a 6-character password). E-mail must be unique and only a
 * superadmin can create superadmins.
 */
@Injectable()
export class CreateUserUseCase implements UseCase<CreateUserInput, UserWithTemporaryPassword> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TEMPORARY_PASSWORD_GENERATOR) private readonly passwords: TemporaryPasswordGeneratorPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly views: ManagedUserViewBuilder,
  ) {}

  async execute({ actor, name, email, role }: CreateUserInput): Promise<UserWithTemporaryPassword> {
    UserAdministrationPolicy.assertCanAssignRole(actor, role);
    const normalizedEmail = Email.create(email).toString();
    if (await this.users.findByEmail(normalizedEmail)) {
      throw new ConflictError('Ya existe un usuario con ese correo electrónico.', { email: normalizedEmail });
    }

    const temporaryPassword = this.passwords.generate();
    const user = User.create({
      name,
      email: normalizedEmail,
      role,
      passwordHash: await this.hasher.hash(temporaryPassword),
      mustChangePassword: true,
    });
    await this.users.save(user);

    const payload: UserCreatedPayload = { userId: user.id as number, name: user.name, email: normalizedEmail, role };
    await this.events.publish({ name: 'identity.user-created', occurredAt: this.clock.now(), payload: { ...payload } });
    return { user: await this.views.one(user), temporaryPassword };
  }
}
