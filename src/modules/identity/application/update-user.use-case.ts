import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Role } from '../../../shared/domain/role.js';
import { Email } from '../../../shared/domain/value-objects/email.vo.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { UserAdministrationPolicy, type UserAdministrator } from '../domain/user-administration-policy.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import type { ManagedUserView } from './managed-user-view.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';

export interface UpdateUserInput {
  actor: UserAdministrator;
  userId: number;
  name?: string;
  email?: string;
  role?: Role;
}

/**
 * Edits name, e-mail and/or role of a user (legacy inline `update_role`).
 * Enforces the anti-escalation rules of {@link UserAdministrationPolicy} and
 * e-mail uniqueness.
 */
@Injectable()
export class UpdateUserUseCase implements UseCase<UpdateUserInput, ManagedUserView> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly views: ManagedUserViewBuilder,
  ) {}

  async execute({ actor, userId, name, email, role }: UpdateUserInput): Promise<ManagedUserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario', userId);
    UserAdministrationPolicy.assertCanManage(actor, user);

    if (role !== undefined) {
      UserAdministrationPolicy.assertCanChangeRole(actor, user, role);
      user.changeRole(role);
    }
    if (name !== undefined) user.rename(name);
    if (email !== undefined) {
      const normalized = Email.create(email).toString();
      const owner = await this.users.findByEmail(normalized);
      if (owner && owner.id !== user.id) {
        throw new ConflictError('Ya existe un usuario con ese correo electrónico.', { email: normalized });
      }
      user.changeEmail(normalized);
    }

    await this.users.save(user);
    return this.views.one(user);
  }
}
