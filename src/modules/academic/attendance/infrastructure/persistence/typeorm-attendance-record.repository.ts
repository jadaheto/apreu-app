import { Injectable } from '@nestjs/common';
import { Between, type FindOptionsWhere } from 'typeorm';
import { ConflictError } from '../../../../../shared/domain/domain-error.js';
import { toOffset, type PageRequest, type Paginated } from '../../../../../shared/domain/pagination.js';
import { isUniqueViolation } from '../../../../../shared/infrastructure/persistence/sql.js';
import { TenantDataSource } from '../../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { DateInterval } from '../../../common/domain/school-calendar.js';
import type { AttendanceRecord, AttendanceStatus } from '../../domain/attendance-record.js';
import type { AttendanceRecordRepository, DailyAttendanceCriteria } from '../../domain/attendance-record.repository.js';
import { AttendanceRecordMapper } from './attendance-record.mapper.js';
import { AttendanceRecordOrmEntity } from './attendance-record.orm-entity.js';

const dayWhere = ({ date, classroomId }: DailyAttendanceCriteria): FindOptionsWhere<AttendanceRecordOrmEntity> =>
  classroomId === undefined ? { attendanceDate: date } : { attendanceDate: date, classroomId };

@Injectable()
export class TypeOrmAttendanceRecordRepository implements AttendanceRecordRepository {
  constructor(private readonly db: TenantDataSource) {}

  async listForClass(subjectId: number, classroomId: number, date: string): Promise<AttendanceRecord[]> {
    const rows = await (
      await this.db.repository(AttendanceRecordOrmEntity)
    ).findBy({
      subjectId,
      classroomId,
      attendanceDate: date,
    });
    return rows.map(AttendanceRecordMapper.toDomain);
  }

  async searchByDate(criteria: DailyAttendanceCriteria, page: PageRequest): Promise<Paginated<AttendanceRecord>> {
    const [rows, total] = await (
      await this.db.repository(AttendanceRecordOrmEntity)
    ).findAndCount({
      where: dayWhere(criteria),
      order: { attendanceTime: 'DESC', id: 'DESC' },
      skip: toOffset(page),
      take: page.limit,
    });
    return { items: rows.map(AttendanceRecordMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async countByStatusOnDate(criteria: DailyAttendanceCriteria): Promise<Map<AttendanceStatus, number>> {
    const query = (await this.db.repository(AttendanceRecordOrmEntity))
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)::int', 'total')
      .where('a.attendance_date = :date', { date: criteria.date });
    if (criteria.classroomId !== undefined) {
      query.andWhere('a.classroom_id = :classroomId', { classroomId: criteria.classroomId });
    }
    const rows: { status: AttendanceStatus; total: string }[] = await query.groupBy('a.status').getRawMany();
    return new Map(rows.map((row) => [row.status, Number(row.total)]));
  }

  async listRecentByStudent(studentId: number, limit: number): Promise<AttendanceRecord[]> {
    const rows = await (
      await this.db.repository(AttendanceRecordOrmEntity)
    ).find({
      where: { studentId },
      order: { attendanceDate: 'DESC', attendanceTime: 'DESC' },
      take: limit,
    });
    return rows.map(AttendanceRecordMapper.toDomain);
  }

  async listByStudentBetween(studentId: number, { from, to }: DateInterval): Promise<AttendanceRecord[]> {
    const rows = await (
      await this.db.repository(AttendanceRecordOrmEntity)
    ).find({
      where: { studentId, attendanceDate: Between(from, to) },
      order: { attendanceDate: 'ASC', attendanceTime: 'ASC' },
    });
    return rows.map(AttendanceRecordMapper.toDomain);
  }

  async countByClassroomAndStatus(
    classroomId: number,
    { from, to }: DateInterval,
    status: AttendanceStatus,
  ): Promise<number> {
    return (await this.db.repository(AttendanceRecordOrmEntity)).countBy({
      classroomId,
      status,
      attendanceDate: Between(from, to),
    });
  }

  async save(record: AttendanceRecord): Promise<void> {
    try {
      const repository = await this.db.repository(AttendanceRecordOrmEntity);
      const saved = await repository.save(AttendanceRecordMapper.toPersistence(record));
      if (record.isNew) record.assignId(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('Asistencia ya registrada hoy para esta clase.');
      throw error;
    }
  }
}
