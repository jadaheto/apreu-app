import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { StudentPhoto } from '../domain/student-photo.js';
import { FILE_STORAGE, type FileStoragePort } from './ports/file-storage.port.js';
import { StudentAccessPolicy } from './student-access.policy.js';

export interface GetStudentPhotoInput {
  actor: AuthenticatedActor;
  studentId: number;
}

export interface StudentPhotoFile {
  content: Uint8Array;
  mimeType: string;
}

/**
 * Serves the photo of a student to the staff or to its owners. Photos are no
 * longer exposed from a public folder.
 */
@Injectable()
export class GetStudentPhotoUseCase implements UseCase<GetStudentPhotoInput, StudentPhotoFile> {
  constructor(
    private readonly access: StudentAccessPolicy,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
  ) {}

  async execute({ actor, studentId }: GetStudentPhotoInput): Promise<StudentPhotoFile> {
    const student = await this.access.load(actor, studentId);
    if (!student.photo) throw new NotFoundError('Foto del estudiante', studentId);
    return {
      content: await this.storage.read(student.photo),
      mimeType: StudentPhoto.mimeTypeFor(student.photo),
    };
  }
}
