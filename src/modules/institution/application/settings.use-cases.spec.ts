import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { InstitutionProfile } from '../domain/institution-profile.js';
import { SECRET_MASK } from '../domain/settings/settings-section.js';
import { InMemoryInstitutionProfileRepository } from '../testing/in-memory-institution-profile.repository.js';
import { InMemorySettingsRepository } from '../testing/in-memory-settings.repository.js';
import { GetPublicBrandingUseCase } from './get-public-branding.use-case.js';
import { GetSettingsCatalogUseCase } from './get-settings-catalog.use-case.js';
import { GetSettingsSectionUseCase } from './get-settings-section.use-case.js';
import { UpdateSettingsSectionUseCase } from './update-settings-section.use-case.js';

describe('settings use cases', () => {
  let settings: InMemorySettingsRepository;
  let unitOfWork: FakeUnitOfWork;
  let events: RecordingEventBus;
  const clock = new FixedClock();

  const update = (role: Role, section: string, values: Record<string, unknown>) =>
    new UpdateSettingsSectionUseCase(settings, unitOfWork, events, clock).execute({ role, section, values });
  const read = (role: Role, section: string) =>
    new GetSettingsSectionUseCase(settings, clock).execute({ role, section });

  beforeEach(() => {
    settings = new InMemorySettingsRepository({ smtp_general_password: 'clave-real', primary_color: '#000000' });
    unitOfWork = new FakeUnitOfWork();
    events = new RecordingEventBus();
  });

  it('lists the sections the role may configure with field metadata', async () => {
    const sections = await new GetSettingsCatalogUseCase().execute(Role.HR);
    expect(sections.map((s) => s.key)).toEqual(['payroll']);
    expect(sections[0]?.fields[0]).toEqual({
      key: 'smlmv',
      label: 'Salario mínimo (SMLMV)',
      type: 'decimal',
      secret: false,
      readOnly: false,
      options: null,
      min: 0,
      max: 9_999_999_999,
      maxLength: null,
    });
  });

  it('reads a section with secrets masked', async () => {
    const view = await read(Role.ADMIN, 'integrations');
    expect(view).toMatchObject({ section: 'integrations', label: 'WhatsApp y correo general' });
    expect(view.values.smtp_general_password).toBe(SECRET_MASK);
    expect(view.values.smtp_general_port).toBe(465);
  });

  it('enforces section access per role', async () => {
    await expect(read(Role.FINANCE, 'integrations')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(update(Role.HR, 'payments', {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(read(Role.ADMIN, 'desconocida')).rejects.toBeInstanceOf(NotFoundError);
    await expect(read(Role.FINANCE, 'payments')).resolves.toMatchObject({ section: 'payments' });
  });

  it('writes atomically, keeps aliases in sync and publishes keys without values', async () => {
    const view = await update(Role.ADMIN, 'integrations', {
      smtp_general_password: SECRET_MASK,
      whatsapp_token: 'EAAG-token',
      smtp_general_port: 587,
    });
    expect(unitOfWork.transactions).toBe(1);
    expect(settings.values.get('smtp_general_password')).toBe('clave-real');
    expect(settings.values.get('whatsapp_token')).toBe('EAAG-token');
    expect(view.values).toMatchObject({ whatsapp_token: SECRET_MASK, smtp_general_port: 587 });
    expect(events.published).toEqual([
      {
        name: 'institution.settings-updated',
        occurredAt: clock.now(),
        payload: { section: 'integrations', keys: ['whatsapp_token', 'smtp_general_port'] },
      },
    ]);

    await update(Role.ADMIN, 'branding', { color_primary: '#123456' });
    expect(settings.values.get('primary_color')).toBe('#123456');
  });

  it('does not publish when nothing changed', async () => {
    await update(Role.ADMIN, 'integrations', { smtp_general_password: SECRET_MASK });
    expect(events.published).toEqual([]);
  });

  it('rejects invalid values without writing anything', async () => {
    await expect(update(Role.ADMIN, 'branding', { color_primary: '#123456', logo_size: 500 })).rejects.toMatchObject({
      code: 'INVALID_SETTING',
    });
    expect(settings.values.get('color_primary')).toBeUndefined();
  });

  describe('GetPublicBrandingUseCase', () => {
    it('falls back to defaults when nothing is configured', async () => {
      const branding = await new GetPublicBrandingUseCase(
        new InMemorySettingsRepository(),
        new InMemoryInstitutionProfileRepository(),
        clock,
      ).execute();
      expect(branding).toEqual({
        schoolName: 'Apreu ERP',
        logoUrl: null,
        logoSize: 40,
        colorPrimary: '#4f46e5',
        colorHeaderBg: '#ffffff',
        colorHeaderBar: '#4f46e5',
        academicYear: 2026,
      });
    });

    it('uses the institution name, logo, colors and academic year setting', async () => {
      const profiles = new InMemoryInstitutionProfileRepository();
      const profile = InstitutionProfile.create({
        name: 'Colegio',
        nit: '900123456',
        documentType: 'NIT',
        personType: 'juridica',
      });
      profile.changeLogo('institution/logo-1.png');
      await profiles.save(profile);
      settings.values.set('academic_year', '2027');
      const branding = await new GetPublicBrandingUseCase(settings, profiles, clock).execute();
      expect(branding).toMatchObject({
        schoolName: 'Colegio',
        logoUrl: '/api/institution/logo',
        colorPrimary: '#000000',
        academicYear: 2027,
      });
    });
  });
});
