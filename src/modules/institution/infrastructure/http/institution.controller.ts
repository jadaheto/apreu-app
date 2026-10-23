import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetInstitutionLogoUseCase } from '../../application/get-institution-logo.use-case.js';
import { GetInstitutionProfileUseCase } from '../../application/get-institution-profile.use-case.js';
import { GetPublicBrandingUseCase } from '../../application/get-public-branding.use-case.js';
import { UpdateInstitutionProfileUseCase } from '../../application/update-institution-profile.use-case.js';
import { UploadInstitutionLogoUseCase } from '../../application/upload-institution-logo.use-case.js';
import { LOGO_MAX_BYTES } from '../../domain/image-upload.js';
import {
  InstitutionProfileResponseDto,
  PublicBrandingResponseDto,
  UpdateInstitutionProfileDto,
  type UploadedImageFile,
} from './dto/institution.dto.js';

/** Institution data, logo and public branding. */
@ApiTags('Institución')
@Controller('institution')
export class InstitutionController {
  constructor(
    private readonly getProfile: GetInstitutionProfileUseCase,
    private readonly updateProfile: UpdateInstitutionProfileUseCase,
    private readonly uploadLogo: UploadInstitutionLogoUseCase,
    private readonly getLogo: GetInstitutionLogoUseCase,
    private readonly getBranding: GetPublicBrandingUseCase,
  ) {}

  @Get()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.FINANCE, Role.HR)
  @ApiOperation({ summary: 'Datos de la institución (RUT, ubicación, contacto)' })
  @ApiOkResponse({ type: InstitutionProfileResponseDto })
  profile() {
    return this.getProfile.execute();
  }

  @Put()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Registra o reemplaza los datos de la institución' })
  @ApiOkResponse({ type: InstitutionProfileResponseDto })
  update(@Body() dto: UpdateInstitutionProfileDto) {
    return this.updateProfile.execute(dto);
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 0 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiOperation({ summary: 'Sube el logo (PNG, JPG o WebP, máx. 2 MB, 16–4096 px)' })
  @ApiOkResponse({ type: InstitutionProfileResponseDto })
  logo(@UploadedFile() file?: UploadedImageFile) {
    return this.uploadLogo.execute({
      content: file?.buffer ?? new Uint8Array(),
      declaredMimeType: file?.mimetype ?? null,
    });
  }

  @Public()
  @Get('logo')
  @Header('Cache-Control', 'no-cache')
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiOperation({ summary: 'Imagen del logo (pública; requiere X-Tenant)' })
  async logoFile(): Promise<StreamableFile> {
    const logo = await this.getLogo.execute();
    return new StreamableFile(logo.content, { type: logo.mimeType, disposition: 'inline' });
  }

  @Public()
  @Get('branding')
  @ApiOperation({ summary: 'Tema visual, nombre y año lectivo del colegio (público; requiere X-Tenant)' })
  @ApiOkResponse({ type: PublicBrandingResponseDto })
  branding() {
    return this.getBranding.execute();
  }
}
