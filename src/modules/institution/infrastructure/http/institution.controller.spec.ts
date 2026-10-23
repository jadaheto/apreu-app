import { StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { IS_PUBLIC_KEY } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetInstitutionLogoUseCase } from '../../application/get-institution-logo.use-case.js';
import { GetInstitutionProfileUseCase } from '../../application/get-institution-profile.use-case.js';
import { GetPublicBrandingUseCase } from '../../application/get-public-branding.use-case.js';
import { UpdateInstitutionProfileUseCase } from '../../application/update-institution-profile.use-case.js';
import { UploadInstitutionLogoUseCase } from '../../application/upload-institution-logo.use-case.js';
import { InstitutionController } from './institution.controller.js';

describe('InstitutionController', () => {
  const mocks = {
    profile: { execute: vi.fn().mockResolvedValue({ name: 'Colegio' }) },
    update: { execute: vi.fn().mockResolvedValue({ name: 'Nuevo' }) },
    upload: { execute: vi.fn().mockResolvedValue({ logoUrl: '/api/institution/logo' }) },
    logo: { execute: vi.fn().mockResolvedValue({ content: new Uint8Array([1, 2]), mimeType: 'image/png' }) },
    branding: { execute: vi.fn().mockResolvedValue({ schoolName: 'Colegio' }) },
  };
  let controller: InstitutionController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InstitutionController],
      providers: [
        { provide: GetInstitutionProfileUseCase, useValue: mocks.profile },
        { provide: UpdateInstitutionProfileUseCase, useValue: mocks.update },
        { provide: UploadInstitutionLogoUseCase, useValue: mocks.upload },
        { provide: GetInstitutionLogoUseCase, useValue: mocks.logo },
        { provide: GetPublicBrandingUseCase, useValue: mocks.branding },
      ],
    }).compile();
    controller = moduleRef.get(InstitutionController);
  });

  it('declares the roles of each endpoint', () => {
    const roles = (method: keyof InstitutionController) =>
      Reflect.getMetadata(ROLES_KEY, InstitutionController.prototype[method]);
    const isPublic = (method: keyof InstitutionController) =>
      Reflect.getMetadata(IS_PUBLIC_KEY, InstitutionController.prototype[method]);
    expect(roles('profile')).toEqual([Role.ADMIN, Role.FINANCE, Role.HR]);
    expect(roles('update')).toEqual([Role.ADMIN]);
    expect(roles('logo')).toEqual([Role.ADMIN]);
    expect(isPublic('logoFile')).toBe(true);
    expect(isPublic('branding')).toBe(true);
    expect(isPublic('update')).toBeUndefined();
  });

  it('reads and replaces the profile', async () => {
    await expect(controller.profile()).resolves.toEqual({ name: 'Colegio' });
    const dto = { name: 'Nuevo', nit: '900123456', documentType: 'NIT' as const, personType: 'juridica' as const };
    await controller.update(dto);
    expect(mocks.update.execute).toHaveBeenCalledWith(dto);
  });

  it('passes the uploaded bytes and declared type to the use case', async () => {
    const buffer = Buffer.from([1, 2, 3]);
    await controller.logo({ buffer, mimetype: 'image/png', size: 3, originalname: 'logo.php.png' });
    expect(mocks.upload.execute).toHaveBeenCalledWith({ content: buffer, declaredMimeType: 'image/png' });
    await controller.logo(undefined);
    expect(mocks.upload.execute).toHaveBeenLastCalledWith({ content: new Uint8Array(), declaredMimeType: null });
  });

  it('streams the logo with its content type', async () => {
    const file = await controller.logoFile();
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({ type: 'image/png', disposition: 'inline' });
  });

  it('returns the public branding', async () => {
    await expect(controller.branding()).resolves.toEqual({ schoolName: 'Colegio' });
  });
});
