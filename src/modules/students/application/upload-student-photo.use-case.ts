import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { StudentPhoto, type PhotoUpload } from '../domain/student-photo.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { FILE_STORAGE, type FileStoragePort } from './ports/file-storage.port.js';

export interface UploadStudentPhotoInput extends PhotoUpload {
  studentId: number;
}

export const STUDENT_PHOTO_DIRECTORY = 'students';

/**
 * Replaces the photo of a student. The file is validated by
 * {@link StudentPhoto} (MIME, extension and signature must agree; ≤ 2 MB) and
 * stored with a server-generated name (fixes S4 of `students/create.php`).
 * The previous file is removed after the new one is linked.
 */
@Injectable()
export class UploadStudentPhotoUseCase implements UseCase<UploadStudentPhotoInput, void> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: UploadStudentPhotoInput): Promise<void> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError('Estudiante', input.studentId);

    const photo = StudentPhoto.from(input);
    const fileName = `student_${student.id}_${this.clock.now().getTime()}.${photo.extension}`;
    const path = await this.storage.save(STUDENT_PHOTO_DIRECTORY, fileName, photo.content);

    const previous = student.photo;
    student.changePhoto(path);
    await this.students.save(student);
    if (previous && previous !== path) await this.storage.remove(previous);
  }
}
