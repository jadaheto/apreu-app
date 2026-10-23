import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../../../shared/application/ports/password-hasher.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { assertStrongPassword } from '../domain/password-policy.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';

export interface ChangePasswordInput {
  userId: number;
  currentPassword: string;
  newPassword: string;
}

/** Lets a signed-in user replace their own password after confirming the current one. */
@Injectable()
export class ChangePasswordUseCase implements UseCase<ChangePasswordInput, void> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
  ) {}

  async execute({ userId, currentPassword, newPassword }: ChangePasswordInput): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario', userId);

    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw new BusinessRuleViolationError('La contraseña actual no es correcta.', 'WRONG_PASSWORD');
    }
    if (currentPassword === newPassword) {
      throw new BusinessRuleViolationError('La nueva contraseña debe ser diferente a la actual.', 'SAME_PASSWORD');
    }
    assertStrongPassword(newPassword);

    user.changePassword(await this.hasher.hash(newPassword));
    await this.users.save(user);
  }
}
