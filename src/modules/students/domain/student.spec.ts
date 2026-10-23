import { ConflictError } from '../../../shared/domain/domain-error.js';
import { Student, type StudentDetails } from './student.js';
import { StudentCode } from './student-code.js';

const details: StudentDetails = {
  firstName: '  Sofía ',
  lastName: 'Gómez',
  documentNumber: ' 1101 ',
};
const enroll = (override: Partial<StudentDetails> = {}) =>
  Student.enroll({
    code: StudentCode.compose(2026, 1),
    details: { ...details, ...override },
    classroomId: 10,
    academicYear: 2026,
    enrollmentDate: '2026-01-20',
    guardianId: null,
    today: '2026-03-15',
  });

describe('Student', () => {
  it('enrolls an active student applying the legacy defaults', () => {
    const student = enroll();
    expect(student).toMatchObject({
      firstName: 'Sofía',
      fullName: 'Sofía Gómez',
      initials: 'SG',
      documentType: 'TI',
      documentNumber: '1101',
      gender: 'M',
      status: 'active',
      isActive: true,
      scholarshipPct: 0,
      userId: null,
      photo: null,
      academicYear: 2026,
      enrollmentDate: '2026-01-20',
    });
    expect(student.code.toString()).toBe('AL20260001');
  });

  it('keeps observations and normalizes the e-mail (bug B13)', () => {
    const student = enroll({
      notes: 'Alérgica al maní',
      email: 'SOFIA@Correo.CO',
      bloodType: 'O+',
    });
    expect(student.notes).toBe('Alérgica al maní');
    expect(student.email).toBe('sofia@correo.co');
    expect(student.bloodType).toBe('O+');
  });

  it.each([
    [{ firstName: ' ' }, 'REQUIRED_FIELD'],
    [{ documentNumber: '' }, 'REQUIRED_FIELD'],
    [{ documentType: 'pa' as never }, 'INVALID_OPTION'],
    [{ gender: 'X' as never }, 'INVALID_OPTION'],
    [{ bloodType: 'C+' as never }, 'INVALID_OPTION'],
    [{ scholarshipPct: 101 }, 'OUT_OF_RANGE'],
    [{ scholarshipPct: Number.NaN }, 'OUT_OF_RANGE'],
    [{ email: 'no-es-correo' }, 'INVALID_EMAIL'],
    [{ birthDate: '2026-02-30' }, 'INVALID_DATE'],
    [{ birthDate: '2026-03-15' }, 'INVALID_BIRTH_DATE'],
    [{ phone: '1'.repeat(21) }, 'MAX_LENGTH'],
  ])('rejects invalid details %o', (override, code) => {
    expect(() => enroll(override)).toThrow(expect.objectContaining({ code }));
  });

  it('rejects an invalid enrollment date', () => {
    expect(() =>
      Student.enroll({
        code: StudentCode.compose(2026, 1),
        details,
        classroomId: null,
        academicYear: 2026,
        enrollmentDate: '20-01-2026',
        guardianId: null,
        today: '2026-03-15',
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
  });

  it('updates details without touching code, status or links', () => {
    const student = enroll();
    student.linkGuardian(4);
    student.updateDetails({ ...details, firstName: 'Sofía Andrea', scholarshipPct: 12.345 }, '2026-03-15');
    expect(student).toMatchObject({
      firstName: 'Sofía Andrea',
      scholarshipPct: 12.35,
      guardianId: 4,
      status: 'active',
    });
    expect(student.code.toString()).toBe('AL20260001');
  });

  it('changes status explicitly and returns the previous one', () => {
    const student = enroll();
    expect(student.changeStatus('withdrawn')).toBe('active');
    expect(student.isActive).toBe(false);
    expect(() => student.changeStatus('withdrawn')).toThrow(expect.objectContaining({ code: 'SAME_STATUS' }));
    expect(() => student.changeStatus('expelled' as never)).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
  });

  it('links a single user account (bug B12)', () => {
    const student = enroll();
    student.linkUser(7);
    student.linkUser(7);
    expect(student.userId).toBe(7);
    expect(() => student.linkUser(8)).toThrow(ConflictError);
  });

  it('manages classroom, guardian and photo', () => {
    const student = enroll();
    student.assignClassroom(null, null);
    expect(student).toMatchObject({ classroomId: null, academicYear: 2026 });
    student.assignClassroom(12, 2027);
    expect(student).toMatchObject({ classroomId: 12, academicYear: 2027 });
    student.linkGuardian(3);
    student.unlinkGuardian();
    expect(student.guardianId).toBeNull();
    student.changePhoto('students/a.jpg');
    expect(student.photo).toBe('students/a.jpg');
    expect(() => student.changePhoto('x'.repeat(256))).toThrow(expect.objectContaining({ code: 'MAX_LENGTH' }));
  });
});
