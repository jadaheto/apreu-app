import { Logger } from '@nestjs/common';
import { DetachedExecutor } from './detached-executor.js';

describe('DetachedExecutor', () => {
  it('runs the task after the current turn and logs failures', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const executor = new DetachedExecutor();
    const order: string[] = [];
    executor.run('ok', async () => void order.push('task'));
    executor.run('falla', async () => {
      throw new Error('boom');
    });
    order.push('caller');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['caller', 'task']);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"falla" falló: boom'), expect.any(String));
    error.mockRestore();
  });
});

describe('DetachedExecutor with BackgroundTasks', () => {
  it('registers the task so shutdown can wait for it', async () => {
    const { BackgroundTasks } = await import('../../../../../shared/infrastructure/runtime/background-tasks.js');
    const tasks = new BackgroundTasks();
    const executor = new DetachedExecutor(tasks);
    let finished = false;
    executor.run('lenta', () => new Promise<void>((resolve) => setTimeout(() => resolve(void (finished = true)), 10)));
    expect(tasks.size).toBe(1);
    await tasks.drain();
    expect(finished).toBe(true);
  });
});
