import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { createStudentsKit, type StudentsKit } from '../testing/students-test-kit.js';
import { ProvisionPortalAccountsUseCase } from './provision-portal-accounts.use-case.js';
import { ResetPortalPasswordUseCase } from './reset-portal-password.use-case.js';

describe('portal accounts', () => {
  let kit: StudentsKit;
  beforeEach(() => {
    kit = createStudentsKit();
  });

  describe('PortalAccountProvisioner', () => {
    it('uses the student e-mail and falls back to {code}@apreu.co when taken', async () => {
      const withEmail = await kit.addStudent({ email: 'sofia@correo.co' });
      await expect(kit.provisioner.forStudent(withEmail)).resolves.toMatchObject({
        status: 'created',
        email: 'sofia@correo.co',
      });

      const taken = await kit.addStudent({ email: 'usado@correo.co' });
      kit.users.add('usado@correo.co', Role.TEACHER);
      const account = await kit.provisioner.forStudent(taken);
      expect(account).toMatchObject({
        status: 'created',
        email: `${taken.code.toString().toLowerCase()}@apreu.co`,
      });
      expect(taken.userId).toBe(account.userId);
    });

    it('skips the student when every candidate e-mail is taken and never reports a fake password (B12)', async () => {
      const student = await kit.addStudent();
      kit.users.add(`${student.code.toString().toLowerCase()}@apreu.co`, Role.STUDENT);
      await expect(kit.provisioner.forStudent(student)).resolves.toMatchObject({
        status: 'skipped',
        temporaryPassword: null,
      });
      expect(student.userId).toBeNull();
    });

    it('links an existing parent account, skips other roles and guardians without e-mail', async () => {
      const parent = kit.users.add('marta@correo.co', Role.PARENT);
      const guardian = await kit.addGuardian();
      await expect(kit.provisioner.forGuardian(guardian)).resolves.toMatchObject({
        status: 'linked',
        userId: parent.id,
      });
      expect(guardian.userId).toBe(parent.id);

      const staffEmail = await kit.addGuardian({
        documentNumber: '2',
        email: 'staff@c.co',
      });
      kit.users.add('staff@c.co', Role.ADMIN);
      await expect(kit.provisioner.forGuardian(staffEmail)).resolves.toMatchObject({ status: 'skipped' });

      const noEmail = await kit.addGuardian({
        documentNumber: '3',
        email: null,
      });
      await expect(kit.provisioner.forGuardian(noEmail)).resolves.toMatchObject({ status: 'skipped' });
    });
  });

  describe('ProvisionPortalAccountsUseCase', () => {
    it('creates the missing accounts of a migrated student and its guardian', async () => {
      const guardian = await kit.addGuardian();
      const student = await kit.addStudent({}, { guardianId: guardian.id });
      const useCase = new ProvisionPortalAccountsUseCase(kit.students, kit.guardians, kit.unitOfWork, kit.provisioner);

      const first = await useCase.execute(student.id as number);
      expect(first.map((a) => a.status)).toEqual(['created', 'created']);
      const second = await useCase.execute(student.id as number);
      expect(second.map((a) => a.status)).toEqual(['already_linked', 'already_linked']);
      expect(kit.unitOfWork.transactions).toBe(2);
      await expect(useCase.execute(404)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('ResetPortalPasswordUseCase', () => {
    it('generates a new random password for the student or guardian account', async () => {
      const guardian = await kit.addGuardian();
      const student = await kit.addStudent({}, { guardianId: guardian.id });
      await new ProvisionPortalAccountsUseCase(kit.students, kit.guardians, kit.unitOfWork, kit.provisioner).execute(
        student.id as number,
      );
      const reset = new ResetPortalPasswordUseCase(kit.students, kit.guardians, kit.users, kit.provisioner);

      const result = await reset.execute({
        studentId: student.id as number,
        holder: 'guardian',
      });
      expect(result).toEqual({
        email: 'marta@correo.co',
        temporaryPassword: 'Temporal3x',
      });
      expect(kit.users.accounts.find((a) => a.id === guardian.userId)?.passwordHash).toBe('hashed:Temporal3x');
    });

    it('fails when the account does not exist', async () => {
      const student = await kit.addStudent();
      const reset = new ResetPortalPasswordUseCase(kit.students, kit.guardians, kit.users, kit.provisioner);
      await expect(reset.execute({ studentId: student.id as number, holder: 'student' })).rejects.toMatchObject({
        code: 'PORTAL_ACCOUNT_MISSING',
      });
      await expect(reset.execute({ studentId: student.id as number, holder: 'guardian' })).rejects.toMatchObject({
        code: 'PORTAL_ACCOUNT_MISSING',
      });
      await expect(reset.execute({ studentId: 404, holder: 'student' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
