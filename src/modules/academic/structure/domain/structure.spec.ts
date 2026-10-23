import { Classroom } from './classroom.js';
import { Grade } from './grade.js';
import { GroupDirectorship } from './group-directorship.js';
import { Subject } from './subject.js';
import { TeachingAssignment } from './teaching-assignment.js';

describe('Grade', () => {
  it('creates with trimmed name and default level', () => {
    const grade = Grade.create({ name: '  Primero ' });
    expect(grade).toMatchObject({ name: 'Primero', level: 'primaria' });
    grade.update({ name: 'Transición', level: 'preescolar' });
    expect(grade).toMatchObject({ name: 'Transición', level: 'preescolar' });
  });

  it.each([
    [{ name: ' ' }, 'REQUIRED_FIELD'],
    [{ name: 'x'.repeat(101) }, 'MAX_LENGTH'],
    [{ name: 'Primero', level: 'universidad' as never }, 'INVALID_OPTION'],
  ])('rejects %o', (data, code) => {
    expect(() => Grade.create(data)).toThrow(expect.objectContaining({ code }));
  });
});

describe('Subject', () => {
  it('normalizes code and area and defaults weekly hours', () => {
    const subject = Subject.create(3, { name: 'Matemáticas', code: ' mat01 ', area: '  ' });
    expect(subject).toMatchObject({ gradeId: 3, code: 'MAT01', area: null, hoursPerWeek: 1 });
  });

  it.each([0, 21, 2.5])('rejects %s weekly hours', (hoursPerWeek) => {
    expect(() => Subject.create(1, { name: 'Física', hoursPerWeek })).toThrow(
      expect.objectContaining({ code: 'OUT_OF_RANGE' }),
    );
  });

  it('rejects long codes', () => {
    expect(() => Subject.create(1, { name: 'X', code: 'C'.repeat(21) })).toThrow(
      expect.objectContaining({ code: 'MAX_LENGTH' }),
    );
  });
});

describe('Classroom', () => {
  const valid = { gradeId: 1, name: '5A', academicYear: 2026 };

  it('defaults the capacity to 30 and reports when it is full', () => {
    const classroom = Classroom.create(valid);
    expect(classroom.capacity).toBe(30);
    expect(classroom.isFullWith(29)).toBe(false);
    expect(classroom.isFullWith(30)).toBe(true);
  });

  it('can change the academic year (B26)', () => {
    const classroom = Classroom.create(valid);
    classroom.update({ ...valid, academicYear: 2027, capacity: 25 });
    expect(classroom).toMatchObject({ academicYear: 2027, capacity: 25 });
  });

  it.each([
    [{ capacity: 0 }, 'OUT_OF_RANGE'],
    [{ capacity: 101 }, 'OUT_OF_RANGE'],
    [{ name: '' }, 'REQUIRED_FIELD'],
    [{ academicYear: 1990 }, 'OUT_OF_RANGE'],
  ])('rejects %o', (override, code) => {
    expect(() => Classroom.create({ ...valid, ...override })).toThrow(expect.objectContaining({ code }));
  });
});

describe('TeachingAssignment', () => {
  const classroom = Classroom.restore(7, { gradeId: 1, name: '5A', capacity: 30, academicYear: 2026 });

  it('takes the year from the classroom and can change teacher', () => {
    const subject = Subject.restore(3, { gradeId: 1, name: 'Mat', code: '', area: null, hoursPerWeek: 1 });
    const assignment = TeachingAssignment.create({ employeeId: 9, subject, classroom });
    expect(assignment).toMatchObject({ subjectId: 3, classroomId: 7, academicYear: 2026, employeeId: 9 });
    assignment.changeTeacher(10);
    expect(assignment.isTaughtBy(10)).toBe(true);
  });

  it('requires the subject to belong to the classroom grade', () => {
    const subject = Subject.restore(3, { gradeId: 2, name: 'Mat', code: '', area: null, hoursPerWeek: 1 });
    expect(() => TeachingAssignment.create({ employeeId: 9, subject, classroom })).toThrow(
      expect.objectContaining({ code: 'SUBJECT_NOT_IN_GRADE' }),
    );
  });
});

describe('GroupDirectorship', () => {
  it('starts active and can end', () => {
    const directorship = GroupDirectorship.start(1, 2, '2026-01-20');
    expect(directorship.isActive).toBe(true);
    directorship.end();
    expect(directorship.isActive).toBe(false);
    expect(() => GroupDirectorship.start(1, 2, '20-01-2026')).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE' }),
    );
  });
});
