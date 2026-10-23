import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { Role } from '../../../../shared/domain/role.js';
import { BackgroundTasks } from '../../../../shared/infrastructure/runtime/background-tasks.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import type { RecordRequestAccessUseCase } from '../../application/record-request-access.use-case.js';
import { RequestAuditMiddleware } from './request-audit.middleware.js';

const tenant = { id: 1, slug: 'demo', name: 'Demo', status: 'active' as const, databaseName: 'apreu_demo' };
const actor = { userId: 3, role: Role.ADMIN, email: 'a@demo.co', name: 'A', tenant: 'demo' };

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('RequestAuditMiddleware', () => {
  const context = new TenantContext();
  let execute: ReturnType<typeof vi.fn>;
  let middleware: RequestAuditMiddleware;
  let tasks: BackgroundTasks;

  const run = (req: Partial<Request> & Record<string, unknown>, statusCode = 200) => {
    const res = Object.assign(new EventEmitter(), { statusCode }) as unknown as Response;
    const next = vi.fn() as NextFunction;
    middleware.use(req as never, res, next);
    return { res: res as unknown as EventEmitter, next };
  };

  beforeEach(() => {
    execute = vi.fn().mockImplementation(async () => context.current()?.slug);
    tasks = new BackgroundTasks();
    middleware = new RequestAuditMiddleware({ execute } as unknown as RecordRequestAccessUseCase, context, tasks);
  });

  it('does not block the pipeline and audits after the response is sent, in the tenant context', async () => {
    const req = { method: 'GET', originalUrl: '/api/students?page=1', ip: '1.2.3.4', tenant, actor };
    const { res, next } = run(req, 403);
    expect(next).toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    res.emit('finish');
    await flush();
    expect(execute).toHaveBeenCalledWith({
      actor,
      request: { method: 'GET', url: '/api/students?page=1', statusCode: 403 },
      ipAddress: '1.2.3.4',
    });
    await expect(execute.mock.results[0].value).resolves.toBe('demo');
  });

  it('skips anonymous requests and requests without a school', async () => {
    run({ method: 'GET', originalUrl: '/api/branding', tenant }).res.emit('finish');
    run({ method: 'GET', originalUrl: '/api/students', actor }).res.emit('finish');
    await flush();
    expect(execute).not.toHaveBeenCalled();
  });

  it('swallows audit failures', async () => {
    execute.mockRejectedValueOnce(new Error('db down'));
    const { res } = run({ method: 'GET', originalUrl: '/api/students', tenant, actor });
    expect(() => res.emit('finish')).not.toThrow();
    await flush();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('tracks the pending write so a graceful shutdown can wait for it', async () => {
    let release!: () => void;
    execute.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
    run({ method: 'GET', originalUrl: '/api/students', tenant, actor }).res.emit('finish');
    expect(tasks.size).toBe(1);
    const drained = tasks.drain();
    release();
    await drained;
    expect(tasks.size).toBe(0);
  });
});
