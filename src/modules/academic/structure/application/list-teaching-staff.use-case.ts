import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { STAFF_DIRECTORY, type StaffDirectoryPort } from '../../common/domain/staff-directory.port.js';
import { toTeacherView, type TeacherView } from './structure-views.js';

/** Active teachers and directors eligible for assignments and group direction. */
@Injectable()
export class ListTeachingStaffUseCase implements UseCase<void, TeacherView[]> {
  constructor(@Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort) {}

  async execute(): Promise<TeacherView[]> {
    return (await this.staff.listTeachingStaff()).map(toTeacherView);
  }
}
