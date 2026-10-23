import { Inject, Injectable } from '@nestjs/common';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { Role } from '../../../shared/domain/role.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository.js';
import type { ManagedUserView } from './managed-user-view.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';

export interface ListUsersInput {
  /** Matches name or e-mail. */
  search?: string;
  role?: Role;
  isActive?: boolean;
  page: PageRequest;
}

/** Paginated, filterable user listing for administrators (legacy `admin/users.php`, which capped at 100 rows). */
@Injectable()
export class ListUsersUseCase implements UseCase<ListUsersInput, Paginated<ManagedUserView>> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly views: ManagedUserViewBuilder,
  ) {}

  async execute({ page, ...criteria }: ListUsersInput): Promise<Paginated<ManagedUserView>> {
    const result = await this.users.search(criteria, page);
    return { ...result, items: await this.views.many(result.items) };
  }
}
