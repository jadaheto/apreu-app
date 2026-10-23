import { ForbiddenError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { actorOf, createStudentsKit, type StudentsKit } from '../testing/students-test-kit.js';
import { GetStudentIdCardUseCase } from './get-student-id-card.use-case.js';
import { VerifyStudentQrUseCase } from './verify-student-qr.use-case.js';

describe('ID card and QR', () => {
  let kit: StudentsKit;
  let idCard: GetStudentIdCardUseCase;
  let verify: VerifyStudentQrUseCase;
  const admin = actorOf(1, Role.ADMIN);
  const teacher = actorOf(2, Role.TEACHER);

  beforeEach(() => {
    kit = createStudentsKit();
    idCard = new GetStudentIdCardUseCase(kit.access, kit.studentViews, kit.settings, kit.signer, kit.clock);
    verify = new VerifyStudentQrUseCase(kit.students, kit.settings, kit.signer, kit.clock, kit.studentViews);
  });

  it('builds the ID card with institution data and a signed QR', async () => {
    const guardian = await kit.addGuardian();
    const student = await kit.addStudent({ bloodType: 'O+' }, { guardianId: guardian.id });

    const card = await idCard.execute({
      actor: admin,
      studentId: student.id as number,
    });

    expect(card).toMatchObject({
      institution: { name: 'Colegio Demo', nit: '900.123.456-7', logoSize: 40 },
      academicYear: 2026,
      student: {
        code: student.code.toString(),
        bloodType: 'O+',
        placement: { gradeName: 'Quinto' },
      },
      guardian: { fullName: 'Marta Ruiz', mobile: '3001234567' },
    });
    expect(card.qr).toMatch(new RegExp(`^APREU1\\|colegio-demo\\|${student.id}\\|2026\\|sig_`));
  });

  it('lets the owner see the card but not other students or finance staff (IDOR S2)', async () => {
    const student = await kit.addStudent();
    student.linkUser(70);
    await expect(
      idCard.execute({
        actor: actorOf(70, Role.STUDENT),
        studentId: student.id as number,
      }),
    ).resolves.toBeDefined();
    await expect(
      idCard.execute({
        actor: actorOf(71, Role.STUDENT),
        studentId: student.id as number,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      idCard.execute({
        actor: actorOf(3, Role.FINANCE),
        studentId: student.id as number,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('resolves the student of a valid QR', async () => {
    const student = await kit.addStudent();
    const { qr } = await idCard.execute({
      actor: admin,
      studentId: student.id as number,
    });
    await expect(verify.execute({ actor: teacher, rawQr: qr })).resolves.toMatchObject({
      id: student.id,
      code: student.code.toString(),
    });
  });

  it.each([
    ['tampered signature', (qr: string) => `${qr.slice(0, -2)}xx`, 'INVALID_QR'],
    ['other student id', (qr: string) => qr.replace(/\|(\d+)\|2026\|/, '|999|2026|'), 'INVALID_QR'],
    ['legacy payload', () => '20261101814264primariaT', 'INVALID_QR'],
  ])('rejects a %s', async (_case, forge, code) => {
    const student = await kit.addStudent();
    const { qr } = await idCard.execute({
      actor: admin,
      studentId: student.id as number,
    });
    await expect(verify.execute({ actor: teacher, rawQr: forge(qr) })).rejects.toMatchObject({ code });
  });

  it('rejects QRs of another school, of another year and of inactive students', async () => {
    const student = await kit.addStudent();
    const { qr } = await idCard.execute({
      actor: admin,
      studentId: student.id as number,
    });

    await expect(
      verify.execute({
        actor: { ...teacher, tenant: 'otro-colegio' },
        rawQr: qr,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_QR',
    });
    kit.settings.profile.academicYear = 2027;
    await expect(verify.execute({ actor: teacher, rawQr: qr })).rejects.toMatchObject({ code: 'QR_EXPIRED' });
    kit.settings.profile.academicYear = 2026;
    student.changeStatus('withdrawn');
    await expect(verify.execute({ actor: teacher, rawQr: qr })).rejects.toMatchObject({ code: 'STUDENT_NOT_ACTIVE' });
  });
});
