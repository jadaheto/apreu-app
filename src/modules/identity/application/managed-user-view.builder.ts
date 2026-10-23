import { Inject, Injectable } from '@nestjs/common';
import { EMPLOYMENT_DIRECTORY, type EmploymentDirectoryPort } from '../domain/employment-status.port.js';
import { EMPLOYMENT_CHECKED_ROLES } from '../domain/employment-status.port.js';
import type { User } from '../domain/user.js';
import { toManagedUserView, type ManagedUserView } from './managed-user-view.js';

/** Builds {@link ManagedUserView}s resolving the employment status of staff users in a single query. */
@Injectable()
export class ManagedUserViewBuilder {
  constructor(@Inject(EMPLOYMENT_DIRECTORY) private readonly employment: EmploymentDirectoryPort) {}

  async many(users: readonly User[]): Promise<ManagedUserView[]> {
    const staff = users.filter((user) => EMPLOYMENT_CHECKED_ROLES.includes(user.role));
    const statuses = staff.length
      ? await this.employment.statusesFor(
          staff.map((user) => ({ userId: user.id as number, email: user.email.toString() })),
        )
      : new Map<number, string>();
    return users.map((user) => toManagedUserView(user, statuses.get(user.id as number) ?? null));
  }

  async one(user: User): Promise<ManagedUserView> {
    const [view] = await this.many([user]);
    return view as ManagedUserView;
  }
}
