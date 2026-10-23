import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { FixedClock } from '../../../../shared/testing/fakes.js';
import { Notification } from '../../domain/notifications/notification.js';
import { FakeDirectory } from '../../testing/fake-directory.js';
import { InMemoryNotificationRepository } from '../../testing/in-memory-repositories.js';
import { CreateNotificationsUseCase, MAX_NOTIFICATION_RECIPIENTS } from './create-notifications.use-case.js';
import { ListMyNotificationsUseCase } from './list-my-notifications.use-case.js';
import { MarkAllNotificationsReadUseCase, MarkNotificationReadUseCase } from './mark-notification-read.use-case.js';

describe('notification use cases', () => {
  let repository: InMemoryNotificationRepository;
  const clock = new FixedClock();

  const add = async (userId: number) => {
    const notification = Notification.create({ userId, title: 'T', message: 'M' }, clock.now());
    await repository.save(notification);
    return notification;
  };

  beforeEach(() => {
    repository = new InMemoryNotificationRepository();
  });

  it('lists only the user notifications with the unread count', async () => {
    const first = await add(1);
    await add(1);
    await add(2);
    first.markAsRead();

    const all = await new ListMyNotificationsUseCase(repository).execute({
      userId: 1,
      unreadOnly: false,
      page: { page: 1, limit: 10 },
    });
    expect(all).toMatchObject({ total: 2, unread: 1 });
    const unread = await new ListMyNotificationsUseCase(repository).execute({
      userId: 1,
      unreadOnly: true,
      page: { page: 1, limit: 10 },
    });
    expect(unread.items).toHaveLength(1);
  });

  it('marks own notifications as read and hides others (no IDOR)', async () => {
    const mine = await add(1);
    const foreign = await add(2);
    const useCase = new MarkNotificationReadUseCase(repository);

    await expect(useCase.execute({ userId: 1, notificationId: mine.id as number })).resolves.toMatchObject({
      isRead: true,
    });
    await expect(useCase.execute({ userId: 1, notificationId: foreign.id as number })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(foreign.isRead).toBe(false);
  });

  it('marks all as read', async () => {
    await add(1);
    await add(1);
    await expect(new MarkAllNotificationsReadUseCase(repository).execute(1)).resolves.toEqual({ updated: 2 });
  });

  it('creates notifications for existing users only', async () => {
    const directory = new FakeDirectory();
    directory.users = [1, 2];
    const useCase = new CreateNotificationsUseCase(repository, directory, clock);

    await expect(
      useCase.execute({ userIds: [1, 2, 2], title: 'Aviso', message: 'Hola', type: 'warning' }),
    ).resolves.toEqual({ created: 2 });
    expect(repository.store.all().map((n) => [n.userId, n.type])).toEqual([
      [1, 'warning'],
      [2, 'warning'],
    ]);
    await expect(useCase.execute({ userIds: [1, 3], title: 'A', message: 'B' })).rejects.toMatchObject({
      code: 'UNKNOWN_USERS',
      details: { unknown: [3] },
    });
    await expect(useCase.execute({ userIds: [], title: 'A', message: 'B' })).rejects.toMatchObject({
      code: 'INVALID_RECIPIENTS',
    });
    const tooMany = Array.from({ length: MAX_NOTIFICATION_RECIPIENTS + 1 }, (_, i) => i + 1);
    await expect(useCase.execute({ userIds: tooMany, title: 'A', message: 'B' })).rejects.toMatchObject({
      code: 'INVALID_RECIPIENTS',
    });
  });
});
