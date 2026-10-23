import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../../../shared/application/ports/password-hasher.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { UserAdministrationPolicy, type UserAdministrator } from '../domain/user-administration-policy.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';
import type { UserWithTemporaryPassword } from './managed-user-view.js';
import {
  TEMPORARY_PASSWORD_GENERATOR,
  type TemporaryPasswordGeneratorPort,
} from './ports/temporary-password-generator.port.js';

export interface ResetUserPasswordInput {
  actor: UserAdministrator;
  userId: number;
}

/**
 * Replaces a user's password with a random temporary one that must be
 * changed at next sign-in (legacy `reset_password`, where the admin typed the
 * new password and could reset a superadmin's).
 */
@Injectable()
export class ResetUserPasswordUseCase implements UseCase<ResetUserPasswordInput, UserWithTemporaryPassword> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TEMPORARY_PASSWORD_GENERATOR) private readonly passwords: TemporaryPasswordGeneratorPort,
    private readonly views: ManagedUserViewBuilder,
  ) {}

  async execute({ actor, userId }: ResetUserPasswordInput): Promise<UserWithTemporaryPassword> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario', userId);
    UserAdministrationPolicy.assertCanManage(actor, user);
    UserAdministrationPolicy.assertCanResetPassword(actor, user);

    const temporaryPassword = this.passwords.generate();
    user.assignTemporaryPassword(await this.hasher.hash(temporaryPassword));
    await this.users.save(user);
    return { user: await this.views.one(user), temporaryPassword };
  }
}
