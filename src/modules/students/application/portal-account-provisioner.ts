import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../../../shared/application/ports/password-hasher.port.js';
import { Role } from '../../../shared/domain/role.js';
import type { Guardian } from '../domain/guardian.js';
import type { Student } from '../domain/student.js';
import { SECRET_GENERATOR, type SecretGeneratorPort } from './ports/secret-generator.port.js';
import { USER_ACCOUNTS, type UserAccountPort } from './ports/user-account.port.js';

/** Domain of the generated login e-mail of students without e-mail (legacy `{code}@apreu.co`). */
export const STUDENT_LOGIN_DOMAIN = 'apreu.co';

export type AccountHolder = 'student' | 'guardian';

/**
 * Outcome of provisioning one portal account. The temporary password is only
 * returned once, in the response body of the request that created it — never
 * in a URL (legacy redirected to `view.php?success=…` with the credentials, S5).
 */
export interface ProvisionedAccount {
  holder: AccountHolder;
  status: 'created' | 'linked' | 'already_linked' | 'skipped';
  userId: number | null;
  email: string | null;
  temporaryPassword: string | null;
  reason: string | null;
}

/**
 * Creates or links the portal users of a student (`student` role) and of
 * their guardian (`parent` role). The caller persists the mutated aggregates.
 *
 * Rules (analysis 03 §3.3, fixing bugs B12/B14/S5):
 * - the student logs in with their e-mail or, if missing or taken,
 *   `{code}@apreu.co`; the created user is linked through `students.user_id`;
 * - the guardian needs an e-mail; an existing `parent` user with that e-mail
 *   (sibling enrolled earlier) is linked instead of duplicated;
 * - passwords are random and hashed with `PASSWORD_HASHER`.
 */
@Injectable()
export class PortalAccountProvisioner {
  constructor(
    @Inject(USER_ACCOUNTS) private readonly users: UserAccountPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SECRET_GENERATOR) private readonly secrets: SecretGeneratorPort,
  ) {}

  async forStudent(student: Student): Promise<ProvisionedAccount> {
    if (student.userId !== null) return this.alreadyLinked('student', student.userId);
    const candidates = [student.email, `${student.code.toString().toLowerCase()}@${STUDENT_LOGIN_DOMAIN}`].filter(
      (email): email is string => Boolean(email),
    );
    for (const email of candidates) {
      if (await this.users.findByEmail(email)) continue;
      const created = await this.create('student', student.fullName, email, Role.STUDENT);
      student.linkUser(created.userId as number);
      return created;
    }
    return this.skipped('student', 'Los correos posibles del estudiante ya están en uso por otros usuarios.');
  }

  async forGuardian(guardian: Guardian): Promise<ProvisionedAccount> {
    if (guardian.userId !== null) return this.alreadyLinked('guardian', guardian.userId);
    if (!guardian.email) return this.skipped('guardian', 'El acudiente no tiene correo electrónico registrado.');

    const existing = await this.users.findByEmail(guardian.email);
    if (existing) {
      if (existing.role !== Role.PARENT) {
        return this.skipped('guardian', 'El correo del acudiente pertenece a un usuario con otro rol.');
      }
      guardian.linkUser(existing.id);
      return {
        holder: 'guardian',
        status: 'linked',
        userId: existing.id,
        email: existing.email,
        temporaryPassword: null,
        reason: null,
      };
    }
    const created = await this.create('guardian', guardian.fullName, guardian.email, Role.PARENT);
    guardian.linkUser(created.userId as number);
    return created;
  }

  /** Generates a new temporary password for an existing account. */
  async resetPassword(userId: number): Promise<string> {
    const password = this.secrets.temporaryPassword();
    await this.users.changePassword(userId, await this.hasher.hash(password));
    return password;
  }

  private async create(
    holder: AccountHolder,
    name: string,
    email: string,
    role: Role.STUDENT | Role.PARENT,
  ): Promise<ProvisionedAccount> {
    const temporaryPassword = this.secrets.temporaryPassword();
    const userId = await this.users.create({
      name,
      email,
      role,
      passwordHash: await this.hasher.hash(temporaryPassword),
    });
    return {
      holder,
      status: 'created',
      userId,
      email,
      temporaryPassword,
      reason: null,
    };
  }

  private alreadyLinked(holder: AccountHolder, userId: number): ProvisionedAccount {
    return {
      holder,
      status: 'already_linked',
      userId,
      email: null,
      temporaryPassword: null,
      reason: null,
    };
  }

  private skipped(holder: AccountHolder, reason: string): ProvisionedAccount {
    return {
      holder,
      status: 'skipped',
      userId: null,
      email: null,
      temporaryPassword: null,
      reason,
    };
  }
}
