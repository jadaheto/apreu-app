import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ChangeStudentStatusUseCase } from '../../application/change-student-status.use-case.js';
import { EnrollStudentUseCase } from '../../application/enroll-student.use-case.js';
import { GetStudentPhotoUseCase } from '../../application/get-student-photo.use-case.js';
import { GetStudentProfileUseCase } from '../../application/get-student-profile.use-case.js';
import { LinkStudentGuardianUseCase } from '../../application/link-student-guardian.use-case.js';
import { ListStudentsUseCase } from '../../application/list-students.use-case.js';
import { ProvisionPortalAccountsUseCase } from '../../application/provision-portal-accounts.use-case.js';
import { ResetPortalPasswordUseCase } from '../../application/reset-portal-password.use-case.js';
import { UpdateStudentUseCase } from '../../application/update-student.use-case.js';
import { UploadStudentPhotoUseCase } from '../../application/upload-student-photo.use-case.js';
import { MAX_PHOTO_BYTES } from '../../domain/student-photo.js';
import {
  ChangeStudentStatusDto,
  EnrollStudentDto,
  LinkGuardianDto,
  ListStudentsQueryDto,
  ResetPortalPasswordDto,
  UpdateStudentDto,
} from './dto/student.dto.js';

/** Subset of the multer file used by the photo endpoint (`@types/multer` is not installed). */
export interface UploadedPhotoFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Student records: directory, enrollment, edition, status, photo, guardian
 * link and portal accounts (legacy `students/index.php`, `create.php`,
 * `view.php`). Writes are restricted to `admin` (fixes S1).
 */
@ApiTags('Estudiantes')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly listStudents: ListStudentsUseCase,
    private readonly enrollStudent: EnrollStudentUseCase,
    private readonly getProfile: GetStudentProfileUseCase,
    private readonly updateStudent: UpdateStudentUseCase,
    private readonly changeStatus: ChangeStudentStatusUseCase,
    private readonly uploadPhoto: UploadStudentPhotoUseCase,
    private readonly getPhoto: GetStudentPhotoUseCase,
    private readonly linkGuardian: LinkStudentGuardianUseCase,
    private readonly provisionAccounts: ProvisionPortalAccountsUseCase,
    private readonly resetPassword: ResetPortalPasswordUseCase,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE, Role.HR)
  @ApiOperation({
    summary: 'Directorio de estudiantes con filtros y paginación',
  })
  list(@Query() query: ListStudentsQueryDto) {
    return this.listStudents.execute({
      criteria: {
        search: query.search,
        status: query.status,
        gradeId: query.gradeId,
        classroomId: query.classroomId,
        academicYear: query.year,
      },
      page: query.toPageRequest(),
    });
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Matricula un estudiante (código, acudiente y cuentas del portal)',
  })
  enroll(@Body() dto: EnrollStudentDto) {
    return this.enrollStudent.execute({
      details: dto.student,
      classroomId: dto.classroomId ?? null,
      enrollmentDate: dto.enrollmentDate,
      guardian:
        dto.guardianId !== undefined ? { guardianId: dto.guardianId } : dto.guardian ? { details: dto.guardian } : null,
      createPortalAccounts: dto.createPortalAccounts,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE, Role.HR)
  @ApiOperation({ summary: 'Ficha 360 del estudiante' })
  profile(@Param('id', ParseIntPipe) id: number) {
    return this.getProfile.execute(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualiza los datos del estudiante' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    const { classroomId, ...details } = dto;
    return this.updateStudent.execute({ studentId: id, details, classroomId });
  }

  @Post(':id/status')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambia el estado (retiro, graduación, suspensión…)',
  })
  status(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangeStudentStatusDto) {
    return this.changeStatus.execute({
      studentId: id,
      status: dto.status,
      reason: dto.reason,
    });
  }

  @Put(':id/photo')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Sube la foto (JPG, PNG o WebP, máx. 2 MB)' })
  async putPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedPhotoFile | undefined,
  ): Promise<void> {
    await this.uploadPhoto.execute({
      studentId: id,
      originalName: file?.originalname ?? '',
      mimeType: file?.mimetype ?? '',
      content: file?.buffer ?? new Uint8Array(),
    });
  }

  @Get(':id/photo')
  @Roles(Role.ADMIN, Role.FINANCE, Role.HR, Role.STUDENT, Role.PARENT)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Foto del estudiante (personal o dueños)' })
  async photo(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const file = await this.getPhoto.execute({ actor, studentId: id });
    return new StreamableFile(Buffer.from(file.content), {
      type: file.mimeType,
      disposition: 'inline',
    });
  }

  @Put(':id/guardian')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Vincula un acudiente existente al estudiante' })
  setGuardian(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkGuardianDto) {
    return this.linkGuardian.execute({
      studentId: id,
      guardianId: dto.guardianId,
    });
  }

  @Delete(':id/guardian')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Desvincula el acudiente del estudiante' })
  removeGuardian(@Param('id', ParseIntPipe) id: number) {
    return this.linkGuardian.execute({ studentId: id, guardianId: null });
  }

  @Post(':id/portal-accounts')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Crea/vincula las cuentas del portal del estudiante y su acudiente',
  })
  portalAccounts(@Param('id', ParseIntPipe) id: number) {
    return this.provisionAccounts.execute(id);
  }

  @Post(':id/portal-accounts/reset-password')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera una contraseña temporal aleatoria para la cuenta del portal',
  })
  resetPortalPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPortalPasswordDto) {
    return this.resetPassword.execute({ studentId: id, holder: dto.holder });
  }
}
