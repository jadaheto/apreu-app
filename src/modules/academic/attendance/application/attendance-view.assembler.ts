import { Inject, Injectable } from '@nestjs/common';
import { indexBy, unique } from '../../common/domain/collections.js';
import {
  STAFF_DIRECTORY,
  type StaffDirectoryPort,
  staffDisplayName,
} from '../../common/domain/staff-directory.port.js';
import {
  STUDENT_DIRECTORY,
  type StudentDirectoryPort,
  studentDisplayName,
} from '../../common/domain/student-directory.port.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
} from '../../structure/domain/structure.repositories.js';
import type { AttendanceRecord } from '../domain/attendance-record.js';
import type { AttendanceRecordView } from './attendance-views.js';

const presentIds = (ids: (number | null)[]): number[] => unique(ids.filter((id): id is number => id !== null));

/** Resolves student, classroom, subject and teacher names with one batched query each. */
@Injectable()
export class AttendanceViewAssembler {
  constructor(
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
  ) {}

  async toViews(records: readonly AttendanceRecord[]): Promise<AttendanceRecordView[]> {
    if (records.length === 0) return [];
    const [students, teachers, classrooms, subjects] = await Promise.all([
      this.students.findByIds(unique(records.map((r) => r.studentId))),
      this.staff.findByIds(unique(records.map((r) => r.employeeId))),
      this.classrooms.findByIds(presentIds(records.map((r) => r.classroomId))),
      this.subjects.findByIds(presentIds(records.map((r) => r.subjectId))),
    ]);
    const studentById = indexBy(students, (s) => s.id);
    const teacherById = indexBy(teachers, (t) => t.id);
    const classroomById = indexBy(classrooms, (c) => c.id as number);
    const subjectById = indexBy(subjects, (s) => s.id as number);

    return records.map((record) => {
      const student = studentById.get(record.studentId);
      const teacher = teacherById.get(record.employeeId);
      return {
        id: record.id as number,
        date: record.date,
        time: record.time,
        status: record.status,
        source: record.source,
        student: student
          ? {
              id: student.id,
              fullName: studentDisplayName(student),
              code: student.code,
              documentNumber: student.documentNumber,
            }
          : null,
        classroomName: record.classroomId === null ? null : (classroomById.get(record.classroomId)?.name ?? null),
        subjectName: record.subjectId === null ? null : (subjectById.get(record.subjectId)?.name ?? null),
        teacherName: teacher ? staffDisplayName(teacher) : null,
      };
    });
  }
}
