import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GenerateCollectionFileUseCase } from '../../application/generate-collection-file.use-case.js';
import { GeneratePayrollDisbursementFileUseCase } from '../../application/generate-payroll-disbursement-file.use-case.js';
import type { BankFile } from '../../domain/bank-files/bank-file.js';
import { CollectionFileDto, PayrollFileDto } from './dto/reports.dto.js';
import { FINANCE_STAFF } from './finance-roles.js';

@ApiTags('Finanzas · Archivos bancarios')
@ApiBearerAuth()
@Controller('finance/bank-files')
export class BankFilesController {
  constructor(
    private readonly collectionFile: GenerateCollectionFileUseCase,
    private readonly payrollFile: GeneratePayrollDisbursementFileUseCase,
  ) {}

  @Post('collection')
  @Roles(...FINANCE_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/plain')
  @ApiOperation({ summary: 'Descarga el TXT de recaudo de estudiantes del mes' })
  async collection(@Body() dto: CollectionFileDto, @Res({ passthrough: true }) res: Response): Promise<string> {
    return this.send(res, await this.collectionFile.execute(dto));
  }

  @Post('payroll')
  @Roles(...FINANCE_STAFF, Role.HR)
  @HttpCode(HttpStatus.OK)
  @ApiProduces('text/plain')
  @ApiOperation({ summary: 'Descarga el TXT de dispersión de nómina de un período cerrado' })
  async payroll(@Body() dto: PayrollFileDto, @Res({ passthrough: true }) res: Response): Promise<string> {
    return this.send(res, await this.payrollFile.execute(dto));
  }

  private send(res: Response, file: BankFile): string {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('X-Records', String(file.records));
    return file.content;
  }
}
