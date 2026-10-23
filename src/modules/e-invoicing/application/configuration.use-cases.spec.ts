import { FakeUnitOfWork, FixedClock } from '../../../shared/testing/fakes.js';
import { IssuerConfig } from '../domain/issuer-config.js';
import { FakeCertificateStore } from '../testing/fakes.js';
import { issuerConfig, resolution, signedInvoice } from '../testing/fixtures.js';
import {
  InMemoryElectronicDocumentRepository,
  InMemoryIssuerConfigRepository,
  InMemoryNumberingResolutionRepository,
} from '../testing/in-memory-repositories.js';
import { GetCatalogUseCase } from './get-catalog.use-case.js';
import { GetCertificateInfoUseCase } from './get-certificate-info.use-case.js';
import { GetDiagnosticsUseCase } from './get-diagnostics.use-case.js';
import { GetIssuerConfigUseCase } from './get-issuer-config.use-case.js';
import { ListResolutionsUseCase } from './list-resolutions.use-case.js';
import { RegisterResolutionUseCase } from './register-resolution.use-case.js';
import { UpdateIssuerConfigUseCase } from './update-issuer-config.use-case.js';
import { UpdateResolutionUseCase } from './update-resolution.use-case.js';

const clock = new FixedClock(new Date('2026-03-15T15:00:00Z'));

describe('issuer configuration', () => {
  it('never exposes the software PIN and resolves DANE names', async () => {
    const configs = new InMemoryIssuerConfigRepository(IssuerConfig.empty());
    const view = await new UpdateIssuerConfigUseCase(configs).execute({
      businessName: 'Colegio SAS',
      nit: '900123456',
      address: 'Calle 1',
      cityCode: '70001',
      softwareId: '22d8dcee-1111-2222-3333-444444444444',
      softwarePin: '12345',
      email: 'fe@colegio.co',
      autoInvoiceOnPayment: true,
    });
    expect(view).toMatchObject({
      dv: '8',
      softwarePinConfigured: true,
      autoInvoiceOnPayment: true,
      location: { cityName: 'SINCELEJO', departmentName: 'SUCRE' },
    });
    expect(view).not.toHaveProperty('softwarePin');
    expect(await new GetIssuerConfigUseCase(configs).execute()).toEqual(view);
    await expect(new UpdateIssuerConfigUseCase(configs).execute({ cityCode: '99999' })).rejects.toMatchObject({
      code: 'INVALID_DANE_CODE',
    });
  });

  it('reports certificate expiry', async () => {
    const view = await new GetCertificateInfoUseCase(new FakeCertificateStore(), clock).execute();
    expect(view).toMatchObject({ expired: false, daysToExpire: 1387 });
    await expect(new GetCertificateInfoUseCase(new FakeCertificateStore(null), clock).execute()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('numbering resolutions', () => {
  let resolutions: InMemoryNumberingResolutionRepository;
  beforeEach(() => {
    resolutions = new InMemoryNumberingResolutionRepository();
  });
  const register = (input: Parameters<RegisterResolutionUseCase['execute']>[0]) =>
    new RegisterResolutionUseCase(resolutions, new FakeUnitOfWork()).execute(input);

  it('registers a range, deactivates the previous one of the type and hides the technical key', async () => {
    const first = await register({
      docType: 'fv',
      prefix: 'fe',
      rangeFrom: 1,
      rangeTo: 100,
      resolutionNumber: '1876',
      validFrom: '2026-01-01',
      validTo: '2027-01-01',
      technicalKey: 'k',
      environment: '1',
    });
    expect(first).toMatchObject({
      prefix: 'FE',
      current: 0,
      remaining: 100,
      technicalKeyConfigured: true,
      active: true,
    });
    expect(first).not.toHaveProperty('technicalKey');
    await register({
      docType: 'fv',
      prefix: 'FE2',
      rangeFrom: 1,
      rangeTo: 100,
      resolutionNumber: '1877',
      validFrom: '2026-01-01',
      validTo: '2027-01-01',
      technicalKey: 'k',
      environment: '1',
    });
    const list = await new ListResolutionsUseCase(resolutions).execute();
    expect(list.map((r) => [r.prefix, r.active])).toEqual([
      ['FE', false],
      ['FE2', true],
    ]);
  });

  it('does not let notes reuse the invoice prefix', async () => {
    await register({
      docType: 'fv',
      prefix: 'FE',
      rangeFrom: 1,
      rangeTo: 100,
      resolutionNumber: '1',
      validFrom: '2026-01-01',
      validTo: '2027-01-01',
      technicalKey: 'k',
      environment: '1',
    });
    await expect(
      register({ docType: 'nc', prefix: 'FE', rangeFrom: 1, rangeTo: 100, environment: '1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      register({
        docType: 'fv',
        prefix: 'FE',
        rangeFrom: 1,
        rangeTo: 100,
        resolutionNumber: '1',
        validFrom: '2026-01-01',
        validTo: '2027-01-01',
        technicalKey: 'k',
        environment: '1',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('updates and reactivates a range', async () => {
    const nc1 = resolution({ docType: 'nc', prefix: 'NC' });
    const nc2 = resolution({ docType: 'nc', prefix: 'NCB' });
    nc1.deactivate();
    await resolutions.save(nc1);
    await resolutions.save(nc2);
    const view = await new UpdateResolutionUseCase(resolutions, new FakeUnitOfWork()).execute({
      id: nc1.id as number,
      active: true,
      rangeTo: 999999999,
    });
    expect(view).toMatchObject({ active: true, rangeTo: 999999999 });
    expect(nc2.isActive).toBe(false);
    await expect(
      new UpdateResolutionUseCase(resolutions, new FakeUnitOfWork()).execute({ id: 99 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('GetDiagnosticsUseCase', () => {
  it('reports the readiness of the configuration', async () => {
    const resolutions = new InMemoryNumberingResolutionRepository();
    await resolutions.save(resolution({ docType: 'fv', rangeFrom: 1, rangeTo: 50 }));
    await resolutions.save(resolution({ docType: 'nc', environment: '1' }));
    const documents = new InMemoryElectronicDocumentRepository();
    await documents.save(signedInvoice());
    const certificates = new FakeCertificateStore();
    certificates.info!.validTo = new Date('2026-04-01T00:00:00Z');

    const view = await new GetDiagnosticsUseCase(
      new InMemoryIssuerConfigRepository(issuerConfig()),
      resolutions,
      documents,
      certificates,
      clock,
    ).execute();
    expect(view.ready).toBe(false);
    expect(view.checks.map((c) => [c.code, c.severity])).toEqual([
      ['CONFIG_COMPLETE', 'ok'],
      ['TEST_SET_ID_MISSING', 'warning'],
      ['CERTIFICATE_EXPIRING', 'warning'],
      ['RESOLUTION_FV_LOW', 'warning'],
      ['RESOLUTION_NC_ENVIRONMENT', 'error'],
      ['RESOLUTION_ND_MISSING', 'warning'],
      ['PENDING_SUBMISSIONS', 'warning'],
    ]);
  });

  it('flags a missing certificate and incomplete data as errors', async () => {
    const view = await new GetDiagnosticsUseCase(
      new InMemoryIssuerConfigRepository(IssuerConfig.empty()),
      new InMemoryNumberingResolutionRepository(),
      new InMemoryElectronicDocumentRepository(),
      new FakeCertificateStore(null),
      clock,
    ).execute();
    expect(view.checks.filter((c) => c.severity === 'error').map((c) => c.code)).toEqual([
      'CONFIG_INCOMPLETE',
      'CERTIFICATE_MISSING',
      'RESOLUTION_FV_MISSING',
    ]);
  });
});

describe('GetCatalogUseCase', () => {
  const catalogs = new GetCatalogUseCase();
  it('serves DIAN and DANE catalogs', async () => {
    expect(await catalogs.execute({ name: 'payment-means' })).toContainEqual({
      code: '47',
      name: 'Transferencia débito bancaria',
    });
    expect((await catalogs.execute({ name: 'dane-departments' })).length).toBe(33);
    expect(await catalogs.execute({ name: 'dane-cities', departmentCode: '70' })).toContainEqual({
      code: '70001',
      name: 'SINCELEJO',
    });
    await expect(catalogs.execute({ name: 'dane-cities', departmentCode: '00' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
