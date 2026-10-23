import { Email } from '../../../../shared/domain/value-objects/email.vo.js';
import { User } from '../../domain/user.js';
import { UserOrmEntity } from './user.orm-entity.js';

/** Translates between the `users` row and the {@link User} aggregate. */
export const UserMapper = {
  toDomain(row: UserOrmEntity): User {
    return User.restore(row.id, {
      name: row.name,
      // Legacy data may contain e-mails that fail the stricter validation; keep them readable.
      email: safeEmail(row.email),
      passwordHash: row.password,
      role: row.role,
      avatar: row.avatar,
      isActive: row.isActive,
      lastLogin: row.lastLogin,
      createdAt: row.createdAt,
      mustChangePassword: row.mustChangePassword,
    });
  },

  toPersistence(user: User): UserOrmEntity {
    const row = new UserOrmEntity();
    if (user.id !== null) row.id = user.id;
    row.name = user.name;
    row.email = user.email.toString();
    row.password = user.passwordHash;
    row.role = user.role;
    row.avatar = user.avatar;
    row.isActive = user.isActive;
    row.lastLogin = user.lastLogin;
    row.mustChangePassword = user.mustChangePassword;
    return row;
  },
};

function safeEmail(raw: string): Email {
  try {
    return Email.create(raw);
  } catch {
    return Email.create(`invalido+${encodeURIComponent(raw).replace(/%/g, '')}@apreu.local`);
  }
}
