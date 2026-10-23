import type { E2eContext } from './e2e-app.js';
import { uniqueSuffix } from './e2e-app.js';

export const NEW_PASSWORD = 'E2eClave2026';

export interface TestUser {
  id: number;
  email: string;
  password: string;
  /** Token obtained with the temporary password; valid after the change (tokens are stateless). */
  token: string;
}

/**
 * Creates an account through `POST /api/users` (temporary password), signs in
 * with it and sets {@link NEW_PASSWORD}. Costs one login (10/min per IP).
 */
export async function createUser(
  ctx: E2eContext,
  adminToken: string,
  role: string,
  name = `E2E ${role}`,
): Promise<TestUser> {
  const email = `e2e.${role}.${uniqueSuffix()}@demo.co`;
  const created = await ctx.api(adminToken).post('/api/users').send({ name, email, role });
  if (created.status !== 201)
    throw new Error(`No se creó el usuario: ${created.status} ${JSON.stringify(created.body)}`);
  const token = await ctx.login(email, created.body.temporaryPassword);
  const changed = await ctx
    .api(token)
    .patch('/api/auth/password')
    .send({ currentPassword: created.body.temporaryPassword, newPassword: NEW_PASSWORD });
  if (changed.status !== 204)
    throw new Error(`No se cambió la clave: ${changed.status} ${JSON.stringify(changed.body)}`);
  return { id: created.body.user.id, email, password: NEW_PASSWORD, token };
}

/** Polls `probe` until it returns a truthy value (fire-and-forget writes such as the access log). */
export async function eventually<T>(probe: () => Promise<T | null | undefined | false>, timeoutMs = 5000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('La condición no se cumplió a tiempo.');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** `YYYY-MM-DD` shape of PostgreSQL `date` columns as returned by the API. */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Bogotá offset is UTC-5 all year (no DST). */
export const bogotaDateOf = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso));

/** Resets an existing account (`POST /api/users/{id}/password-reset`), signs in and sets {@link NEW_PASSWORD}. */
export async function takeOverUser(ctx: E2eContext, adminToken: string, userId: number): Promise<TestUser> {
  const reset = await ctx.api(adminToken).post(`/api/users/${userId}/password-reset`);
  if (reset.status !== 200)
    throw new Error(`No se restableció la clave: ${reset.status} ${JSON.stringify(reset.body)}`);
  const email: string = reset.body.user.email;
  const token = await ctx.login(email, reset.body.temporaryPassword);
  const changed = await ctx
    .api(token)
    .patch('/api/auth/password')
    .send({ currentPassword: reset.body.temporaryPassword, newPassword: NEW_PASSWORD });
  if (changed.status !== 204)
    throw new Error(`No se cambió la clave: ${changed.status} ${JSON.stringify(changed.body)}`);
  return { id: userId, email, password: NEW_PASSWORD, token };
}

/** Demo teacher Marta Ruiz (user 6, employee 2), who teaches Matemáticas in 6A. */
export const DEMO_TEACHER_USER_ID = 6;
