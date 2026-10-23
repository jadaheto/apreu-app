import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { SqlPortalStudentLinks } from './sql-portal-student-links.js';

describe('SqlPortalStudentLinks', () => {
  const query = vi.fn();
  const links = new SqlPortalStudentLinks({ manager: async () => ({ query }) } as unknown as TenantDataSource);

  beforeEach(() => query.mockReset().mockResolvedValue([{ id: '3' }, { id: 5 }]));

  it('links a student by user_id, with the e-mail only for unlinked records', async () => {
    await expect(links.studentIdsLinkedTo({ userId: 7, email: 'a@b.co', role: 'student' })).resolves.toEqual([3, 5]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/s\.user_id = \$1\s+OR \(s\.user_id IS NULL[\s\S]*LOWER\(\$2\)/);
    expect(params).toEqual([7, 'a@b.co']);
  });

  it('links a guardian through guardians.user_id', async () => {
    await links.studentIdsLinkedTo({ userId: 8, email: 'g@b.co', role: 'parent' });
    expect(query.mock.calls[0][0]).toMatch(/INNER JOIN guardians g ON g\.id = s\.guardian_id[\s\S]*g\.user_id = \$1/);
  });

  it('returns nothing for other roles without querying', async () => {
    await expect(links.studentIdsLinkedTo({ userId: 1, email: 'x@b.co', role: 'teacher' })).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('reads the payments of a student', async () => {
    await expect(links.paymentIdsOfStudent(3)).resolves.toEqual([3, 5]);
    expect(query).toHaveBeenCalledWith('SELECT id FROM payments WHERE student_id = $1', [3]);
  });
});
