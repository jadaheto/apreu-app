import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, UnauthorizedError } from '../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import { toUserView, type UserView } from './user-view.js';

/** Returns the profile of the signed-in user; disabled users lose access immediately. */
@Injectable()
export class GetCurrentUserUseCase implements UseCase<number, UserView> {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: number): Promise<UserView> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario', userId);
    if (!user.isActive) throw new UnauthorizedError('Su usuario fue desactivado.');
    return toUserView(user);
  }
}
