import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import type { InstitutionProfileData } from '../domain/institution-profile.js';
import { pngImage, webpImage } from '../testing/image-fixtures.js';
import { InMemoryAssetStorage } from '../testing/in-memory-asset-storage.js';
import { InMemoryInstitutionProfileRepository } from '../testing/in-memory-institution-profile.repository.js';
import { GetInstitutionLogoUseCase } from './get-institution-logo.use-case.js';
import { GetInstitutionProfileUseCase } from './get-institution-profile.use-case.js';
import { UpdateInstitutionProfileUseCase } from './update-institution-profile.use-case.js';
import { UploadInstitutionLogoUseCase } from './upload-institution-logo.use-case.js';

const data: InstitutionProfileData = {
  name: 'Colegio San José',
  nit: '900123456',
  documentType: 'NIT',
  personType: 'juridica',
};

describe('institution profile use cases', () => {
  let profiles: InMemoryInstitutionProfileRepository;
  let storage: InMemoryAssetStorage;
  let unitOfWork: FakeUnitOfWork;
  let events: RecordingEventBus;
  let clock: FixedClock;

  const update = (input: InstitutionProfileData = data) =>
    new UpdateInstitutionProfileUseCase(profiles, unitOfWork, events, clock).execute(input);
  const upload = (content: Uint8Array, declaredMimeType: string | null = null) =>
    new UploadInstitutionLogoUseCase(profiles, storage, unitOfWork, clock).execute({ content, declaredMimeType });

  beforeEach(() => {
    profiles = new InMemoryInstitutionProfileRepository();
    storage = new InMemoryAssetStorage();
    unitOfWork = new FakeUnitOfWork();
    events = new RecordingEventBus();
    clock = new FixedClock();
  });

  it('returns 404 until the institution is configured', async () => {
    await expect(new GetInstitutionProfileUseCase(profiles).execute()).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates and then replaces the profile in a transaction, publishing the change', async () => {
    const created = await update();
    expect(created).toMatchObject({ id: 1, nit: '900123456', nitDv: 8, nitFormatted: '900123456-8', logoUrl: null });

    const updated = await update({ ...data, name: 'Colegio Nuevo' });
    expect(updated).toMatchObject({ id: 1, name: 'Colegio Nuevo' });
    expect(unitOfWork.transactions).toBe(2);
    expect(events.published.at(-1)).toEqual({
      name: 'institution.profile-updated',
      occurredAt: clock.now(),
      payload: { name: 'Colegio Nuevo', nit: '900123456', nitDv: 8 },
    });
    await expect(new GetInstitutionProfileUseCase(profiles).execute()).resolves.toMatchObject({
      name: 'Colegio Nuevo',
    });
  });

  it('stores a valid logo under a generated name and removes the previous one', async () => {
    await update();
    const first = await upload(pngImage(), 'image/png');
    expect(first.logoUrl).toBe('/api/institution/logo');
    const firstKey = profiles.profile?.logoPath as string;
    expect(firstKey).toMatch(/^institution\/logo-\d+\.png$/);

    clock.advance(1000);
    await upload(webpImage());
    const secondKey = profiles.profile?.logoPath as string;
    expect(secondKey).toMatch(/\.webp$/);
    expect([...storage.files.keys()]).toEqual([secondKey]);
  });

  it('requires the institution profile before the logo and leaves no orphan file', async () => {
    await expect(upload(pngImage())).rejects.toMatchObject({ code: 'INSTITUTION_NOT_CONFIGURED' });
    expect(storage.files.size).toBe(0);
  });

  it('rejects invalid images before touching the storage', async () => {
    await update();
    await expect(upload(new TextEncoder().encode('<?php ?>'), 'image/png')).rejects.toMatchObject({
      code: 'UNSUPPORTED_IMAGE',
    });
    expect(storage.files.size).toBe(0);
  });

  it('serves the logo with the content type of its bytes', async () => {
    const getLogo = new GetInstitutionLogoUseCase(profiles, storage);
    await expect(getLogo.execute()).rejects.toBeInstanceOf(NotFoundError);
    await update();
    await upload(pngImage());
    await expect(getLogo.execute()).resolves.toMatchObject({ mimeType: 'image/png' });
    storage.files.clear();
    await expect(getLogo.execute()).rejects.toBeInstanceOf(NotFoundError);
  });
});
