import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  type StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { toFileResponse } from '../../../common/infrastructure/http/file-response.js';
import { DownloadGroupReportCardsUseCase } from '../../application/download-group-report-cards.use-case.js';
import { DownloadReportCardPdfUseCase } from '../../application/download-report-card-pdf.use-case.js';
import { GenerateReportCardsUseCase } from '../../application/generate-report-cards.use-case.js';
import { GetGroupReportCardsUseCase } from '../../application/get-group-report-cards.use-case.js';
import { GetReportCardUseCase } from '../../application/get-report-card.use-case.js';
import { ListStudentReportCardsUseCase } from '../../application/list-student-report-cards.use-case.js';
import { RequiredPeriodQueryDto } from './dto/assessment.dto.js';

/** Staff roles that may be group directors (legacy `group_bulletins.php` / `group_director.php`). */
const DIRECTOR_ROLES = [Role.ADMIN, Role.TEACHER, Role.EMPLOYEE, Role.HR, Role.FINANCE];

/** Report cards (legacy `close_period.php`, `bulletin_view.php`, `group_bulletins.php`, `student/boletines.php`). */
@ApiTags('Académico · Boletines')
@ApiBearerAuth()
@Controller('academic')
export class ReportCardsController {
  constructor(
    private readonly generate: GenerateReportCardsUseCase,
    private readonly listForStudent: ListStudentReportCardsUseCase,
    private readonly getReportCard: GetReportCardUseCase,
    private readonly downloadPdf: DownloadReportCardPdfUseCase,
    private readonly groupReportCards: GetGroupReportCardsUseCase,
    private readonly downloadGroup: DownloadGroupReportCardsUseCase,
  ) {}

  @Post('periods/:periodId/report-cards')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Genera (o regenera) los boletines de un período cerrado' })
  generateForPeriod(@Param('periodId', ParseIntPipe) periodId: number) {
    return this.generate.execute(periodId);
  }

  @Get('students/:studentId/report-cards')
  @ApiOperation({ summary: 'Historial de boletines (admin, estudiante, acudiente, director de grupo)' })
  history(@CurrentActor() actor: AuthenticatedActor, @Param('studentId', ParseIntPipe) studentId: number) {
    return this.listForStudent.execute({ actor, studentId });
  }

  @Get('report-cards/:studentId/:periodId')
  @ApiOperation({ summary: 'Boletín de un estudiante en un período (registra la consulta del estudiante/acudiente)' })
  reportCard(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('periodId', ParseIntPipe) periodId: number,
  ) {
    return this.getReportCard.execute({ actor, studentId, periodId });
  }

  @Get('report-cards/:studentId/:periodId/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Boletín en PDF' })
  async pdf(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<StreamableFile> {
    return toFileResponse(await this.downloadPdf.execute({ actor, studentId, periodId }));
  }

  @Get('director/classrooms/:classroomId/report-cards')
  @Roles(...DIRECTOR_ROLES)
  @ApiOperation({ summary: 'Estado de boletines del grupo y KPIs (director del salón o admin)' })
  group(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('classroomId', ParseIntPipe) classroomId: number,
    @Query() query: RequiredPeriodQueryDto,
  ) {
    return this.groupReportCards.execute({ actor, classroomId, periodId: query.periodId });
  }

  @Get('director/classrooms/:classroomId/report-cards/zip')
  @Roles(...DIRECTOR_ROLES)
  @ApiProduces('application/zip')
  @ApiOperation({ summary: 'ZIP con los boletines PDF del grupo' })
  async zip(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('classroomId', ParseIntPipe) classroomId: number,
    @Query() query: RequiredPeriodQueryDto,
  ): Promise<StreamableFile> {
    return toFileResponse(await this.downloadGroup.execute({ actor, classroomId, periodId: query.periodId }));
  }
}
