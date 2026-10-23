import type { E2eContext } from './e2e-app.js';
import { uniqueSuffix } from './e2e-app.js';

/** Classroom 6A (grade Sexto, year 2026) of the cloned demo school. */
export const DEMO_CLASSROOM_ID = 1;

export interface EnrolledStudent {
  id: number;
  code: string;
  guardianId: number | null;
  /** Portal accounts created on enrollment (temporary passwords). */
  accounts: { holder: string; email: string | null; temporaryPassword: string | null; userId: number | null }[];
  body: Record<string, any>;
}

/** Unique numeric document so repeated runs never collide. */
export const uniqueDocument = (): string => `9${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;

export async function enrollStudent(
  ctx: E2eContext,
  token: string,
  overrides: { firstName?: string; lastName?: string; withGuardian?: boolean; portal?: boolean } = {},
): Promise<EnrolledStudent> {
  const suffix = uniqueSuffix();
  const res = await ctx
    .api(token)
    .post('/api/students')
    .send({
      student: {
        firstName: overrides.firstName ?? 'Estudiante',
        lastName: overrides.lastName ?? `E2E ${suffix}`,
        documentType: 'TI',
        documentNumber: uniqueDocument(),
        birthDate: '2015-04-20',
        gender: 'F',
      },
      classroomId: DEMO_CLASSROOM_ID,
      guardian:
        overrides.withGuardian === false
          ? undefined
          : {
              documentType: 'cc',
              documentNumber: uniqueDocument(),
              firstName: 'Acudiente',
              lastName: `E2E ${suffix}`,
              relationship: 'madre',
              email: `e2e.acudiente.${suffix}@demo.co`,
              mobile: '3001234567',
            },
      createPortalAccounts: overrides.portal ?? false,
    });
  if (res.status !== 201) throw new Error(`Matrícula falló: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    id: res.body.student.id,
    code: res.body.student.code,
    guardianId: res.body.student.guardian?.id ?? null,
    accounts: res.body.accounts,
    body: res.body,
  };
}
