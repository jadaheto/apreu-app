import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetCertificateInfoUseCase } from '../../application/get-certificate-info.use-case.js';
import { GetDiagnosticsUseCase } from '../../application/get-diagnostics.use-case.js';
import { GetIssuerConfigUseCase } from '../../application/get-issuer-config.use-case.js';
import { UpdateIssuerConfigUseCase } from '../../application/update-issuer-config.use-case.js';
import { UpdateIssuerConfigDto } from './dto/issuer-config.dto.js';

/** Issuer configuration, signing certificate and diagnostics (legacy `settings.php` DIAN tab, `finance/dian_diagnostic.php`). */
@ApiTags('Facturación electrónica · Configuración')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FINANCE)
@Controller('e-invoicing')
export class IssuerConfigController {
  constructor(
    private readonly getConfig: GetIssuerConfigUseCase,
    private readonly updateConfig: UpdateIssuerConfigUseCase,
    private readonly certificateInfo: GetCertificateInfoUseCase,
    private readonly diagnostics: GetDiagnosticsUseCase,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Datos del emisor y del software DIAN (sin secretos)' })
  show() {
    return this.getConfig.execute();
  }

  @Put('config')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Actualiza los datos del emisor, software y facturación automática' })
  update(@Body() dto: UpdateIssuerConfigDto) {
    return this.updateConfig.execute(dto);
  }

  @Get('config/certificate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Metadatos y vigencia del certificado de firma digital' })
  certificate() {
    return this.certificateInfo.execute();
  }

  @Get('diagnostics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Chequeos de configuración antes de emitir' })
  diagnose() {
    return this.diagnostics.execute();
  }
}
