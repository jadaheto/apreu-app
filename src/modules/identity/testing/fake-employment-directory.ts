import type { EmployeeLinkKey, EmploymentDirectoryPort } from '../domain/employment-status.port.js';

/** Employment statuses keyed by user id; records which users were looked up. */
export class FakeEmploymentDirectory implements EmploymentDirectoryPort {
  readonly statuses = new Map<number, string>();
  readonly lookups: EmployeeLinkKey[][] = [];

  async statusesFor(users: readonly EmployeeLinkKey[]): Promise<ReadonlyMap<number, string>> {
    this.lookups.push([...users]);
    return new Map(
      users.filter((u) => this.statuses.has(u.userId)).map((u) => [u.userId, this.statuses.get(u.userId) as string]),
    );
  }
}
