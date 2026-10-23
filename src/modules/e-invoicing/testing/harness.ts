import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { DocumentIssuer } from '../application/services/document-issuer.js';
import { DocumentSubmitter } from '../application/services/document-submitter.js';
import type { AttachedDocumentBuilderPort } from '../application/ports/attached-document-builder.port.js';
import type { UblDocumentBuilderPort } from '../application/ports/ubl-document-builder.port.js';
import type { XmlSignerPort } from '../application/ports/xml-signer.port.js';
import type { ZipArchiverPort } from '../application/ports/zip-archiver.port.js';
import type { IssuerConfig } from '../domain/issuer-config.js';
import type { NumberingResolution } from '../domain/numbering-resolution.js';
import {
  FakeAttachedDocumentBuilder,
  FakeCertificateStore,
  FakeDianGateway,
  FakeSigner,
  FakeUblBuilder,
  FakeZipArchiver,
  ManualExecutor,
} from './fakes.js';
import { issuerConfig, resolution } from './fixtures.js';
import {
  InMemoryElectronicDocumentRepository,
  InMemoryIssuerConfigRepository,
  InMemoryNumberingResolutionRepository,
} from './in-memory-repositories.js';

export interface HarnessOptions {
  config?: IssuerConfig;
  resolutions?: NumberingResolution[];
  builder?: UblDocumentBuilderPort;
  signer?: XmlSignerPort;
  zipper?: ZipArchiverPort;
  attachedBuilder?: AttachedDocumentBuilderPort;
}

/**
 * Real application services (`DocumentIssuer`, `DocumentSubmitter`) wired to
 * in-memory repositories and doubles of every external port. The DIAN is a
 * scripted fake: no network access.
 */
export function createHarness(options: HarnessOptions = {}) {
  const clock = new FixedClock(new Date('2026-03-15T15:00:00Z'));
  const configs = new InMemoryIssuerConfigRepository(options.config ?? issuerConfig());
  const resolutions = new InMemoryNumberingResolutionRepository();
  (
    options.resolutions ?? [resolution({ docType: 'fv' }), resolution({ docType: 'nc' }), resolution({ docType: 'nd' })]
  ).forEach((r) => resolutions.store.save(r));
  const documents = new InMemoryElectronicDocumentRepository();
  const certificates = new FakeCertificateStore();
  const builder = options.builder ?? new FakeUblBuilder();
  const signer = options.signer ?? new FakeSigner();
  const gateway = new FakeDianGateway();
  const zipper = options.zipper ?? new FakeZipArchiver();
  const events = new RecordingEventBus();
  const unitOfWork = new FakeUnitOfWork();
  const executor = new ManualExecutor();

  const issuer = new DocumentIssuer(configs, resolutions, documents, certificates, builder, signer, unitOfWork, clock);
  const submitter = new DocumentSubmitter(
    documents,
    configs,
    gateway,
    zipper,
    options.attachedBuilder ?? new FakeAttachedDocumentBuilder(),
    signer,
    events,
    clock,
  );
  return {
    clock,
    configs,
    resolutions,
    documents,
    certificates,
    builder,
    signer,
    gateway,
    zipper,
    events,
    unitOfWork,
    executor,
    issuer,
    submitter,
  };
}

export type Harness = ReturnType<typeof createHarness>;
