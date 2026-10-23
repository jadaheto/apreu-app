import { Notification } from './notification.js';

describe('Notification', () => {
  const at = new Date('2026-03-15T10:00:00Z');

  it('creates unread notifications for a user', () => {
    const notification = Notification.create({ userId: 3, title: ' Hola ', message: ' Mensaje ' }, at);
    expect(notification).toMatchObject({ userId: 3, title: 'Hola', message: 'Mensaje', type: 'info', isRead: false });
    expect(notification.belongsTo(3)).toBe(true);
    expect(notification.belongsTo(4)).toBe(false);
    notification.markAsRead();
    expect(notification.isRead).toBe(true);
  });

  it.each([
    [{ title: '' }, 'REQUIRED_FIELD'],
    [{ title: 'x'.repeat(201) }, 'MAX_LENGTH'],
    [{ message: ' ' }, 'REQUIRED_FIELD'],
    [{ type: 'urgent' as never }, 'INVALID_OPTION'],
    [{ userId: 0 }, 'REQUIRED_FIELD'],
  ])('rejects %o', (override, code) => {
    expect(() => Notification.create({ userId: 1, title: 'T', message: 'M', ...override }, at)).toThrow(
      expect.objectContaining({ code }),
    );
  });
});
