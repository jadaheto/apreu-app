import { Role } from '../../../shared/domain/role.js';
import type { AccessLogEntry, AccessLogPort } from './ports/access-log.port.js';
import { RecordRequestAccessUseCase } from './record-request-access.use-case.js';

describe('RecordRequestAccessUseCase', () => {
  const actor = { userId: 7, role: Role.FINANCE, email: 'f@demo.co', name: 'F', tenant: 'demo' };
  let entries: AccessLogEntry[];
  let useCase: RecordRequestAccessUseCase;

  beforeEach(() => {
    entries = [];
    const log: AccessLogPort = { record: async (entry) => void entries.push(entry) };
    useCase = new RecordRequestAccessUseCase(log);
  });

  it('records the actor, path, module, outcome and IP', async () => {
    await expect(
      useCase.execute({
        actor,
        request: { method: 'GET', url: '/api/hr/employees?page=2', statusCode: 403 },
        ipAddress: '10.0.0.1',
      }),
    ).resolves.toBe(true);
    expect(entries).toEqual([
      {
        userId: 7,
        role: 'finance',
        path: 'GET /api/hr/employees',
        module: 'hr',
        allowed: false,
        ipAddress: '10.0.0.1',
      },
    ]);
  });

  it('skips requests excluded by the policy', async () => {
    await expect(
      useCase.execute({ actor, request: { method: 'POST', url: '/api/auth/logout', statusCode: 204 }, ipAddress: '' }),
    ).resolves.toBe(false);
    expect(entries).toEqual([]);
  });
});
