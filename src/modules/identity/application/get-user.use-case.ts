import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import type { ManagedUserView } from './managed-user-view.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';

/** Detail of a user for the administration screen. */
@Injectable()
export class GetUserUseCase implements UseCase<number, ManagedUserView> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly views: ManagedUserViewBuilder,
  ) {}

  async execute(userId: number): Promise<ManagedUserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario', userId);
    return this.views.one(user);
  }
}
