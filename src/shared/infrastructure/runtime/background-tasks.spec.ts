import { BackgroundTasks } from './background-tasks.js';

describe('BackgroundTasks', () => {
  it('drain waits for tracked tasks, including ones started while draining', async () => {
    const tasks = new BackgroundTasks();
    const done: string[] = [];
    const later = (label: string, ms: number) =>
      new Promise<void>((resolve) => setTimeout(() => resolve(void done.push(label)), ms));
    tasks.track(
      later('first', 10).then(() => {
        tasks.track(later('second', 10));
      }),
    );
    expect(tasks.size).toBe(1);
    await tasks.drain();
    expect(done).toEqual(['first', 'second']);
    expect(tasks.size).toBe(0);
  });

  it('forgets rejected tasks and does not throw', async () => {
    const tasks = new BackgroundTasks();
    const failing = tasks.track(Promise.reject(new Error('boom')));
    await expect(failing).rejects.toThrow('boom');
    await expect(tasks.drain()).resolves.toBeUndefined();
    expect(tasks.size).toBe(0);
  });

  it('gives up after the timeout', async () => {
    const tasks = new BackgroundTasks();
    tasks.track(new Promise(() => undefined));
    const started = Date.now();
    await tasks.drain(20);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(tasks.size).toBe(1);
  });
});
