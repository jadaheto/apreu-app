import { InProcessEventBus } from './in-process-event-bus.js';

describe('InProcessEventBus', () => {
  const event = { name: 'finance.payment-registered', occurredAt: new Date(), payload: { paymentId: 1 } };

  it('delivers events to every subscriber in order', async () => {
    const bus = new InProcessEventBus();
    const calls: string[] = [];
    bus.subscribe(event.name, () => void calls.push('a'));
    bus.subscribe(event.name, async () => void calls.push('b'));
    bus.subscribe('other', () => void calls.push('x'));

    await bus.publish(event);

    expect(calls).toEqual(['a', 'b']);
  });

  it('isolates failing handlers', async () => {
    const bus = new InProcessEventBus();
    const after = vi.fn();
    bus.subscribe(event.name, () => {
      throw new Error('boom');
    });
    bus.subscribe(event.name, after);

    await expect(bus.publish(event)).resolves.toBeUndefined();
    expect(after).toHaveBeenCalled();
  });
});
