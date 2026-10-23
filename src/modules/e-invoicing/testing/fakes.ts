import { ExternalServiceError } from '../../../shared/domain/domain-error.js';
import type { AttachedDocumentBuilderPort } from '../application/ports/attached-document-builder.port.js';
import type { BackgroundExecutorPort } from '../application/ports/background-executor.port.js';
import type { CertificateInfo, CertificateStorePort } from '../application/ports/certificate-store.port.js';
import type { DianGatewayPort } from '../application/ports/dian-gateway.port.js';
import {
  SIGNATURE_PLACEHOLDER,
  type UblBuildInput,
  type UblDocumentBuilderPort,
} from '../application/ports/ubl-document-builder.port.js';
import type { XmlSignerPort } from '../application/ports/xml-signer.port.js';
import type { ZipArchiverPort } from '../application/ports/zip-archiver.port.js';
import type { DocumentArtifact } from '../application/get-document-artifact.use-case.js';
import type { InvoicePdfInput, InvoicePdfRendererPort } from '../application/ports/invoice-pdf-renderer.port.js';
import type { PortalStudentLinksPort, PortalUser } from '../domain/portal-student-links.port.js';
import type { DianEnvironment } from '../domain/catalogs.js';
import type { DianResponse } from '../domain/dian-response.js';
import { dianResponse } from './fixtures.js';

type GatewayCall =
  | { operation: 'SendBillSync'; environment: DianEnvironment; zipFileName: string }
  | { operation: 'SendTestSetAsync'; environment: DianEnvironment; zipFileName: string; testSetId: string }
  | { operation: 'GetStatusZip'; environment: DianEnvironment; trackId: string };

/** DIAN double: answers from a queue (a `Error` entry is thrown) and records every call. Never touches the network. */
export class FakeDianGateway implements DianGatewayPort {
  readonly calls: GatewayCall[] = [];
  /** ZIP payloads received by the send operations. */
  readonly zips: Buffer[] = [];
  private readonly queue: (DianResponse | Error)[] = [];

  willRespond(...responses: (DianResponse | Error)[]): this {
    this.queue.push(...responses);
    return this;
  }

  willFailTransport(message = 'sin respuesta de la DIAN'): this {
    return this.willRespond(new ExternalServiceError('DIAN', message));
  }

  async sendBillSync(environment: DianEnvironment, zipFileName: string, zip: Buffer): Promise<DianResponse> {
    this.calls.push({ operation: 'SendBillSync', environment, zipFileName });
    this.zips.push(zip);
    return this.next();
  }

  async sendTestSetAsync(
    environment: DianEnvironment,
    zipFileName: string,
    zip: Buffer,
    testSetId: string,
  ): Promise<DianResponse> {
    this.calls.push({ operation: 'SendTestSetAsync', environment, zipFileName, testSetId });
    this.zips.push(zip);
    return this.next(
      dianResponse({
        statusCode: null,
        statusDescription: null,
        isValid: null,
        trackId: 'zip-key-1',
        applicationResponse: null,
        applicationResponseCode: null,
      }),
    );
  }

  async getStatusZip(environment: DianEnvironment, trackId: string): Promise<DianResponse> {
    this.calls.push({ operation: 'GetStatusZip', environment, trackId });
    return this.next();
  }

  private next(fallback: DianResponse = dianResponse()): DianResponse {
    const response = this.queue.shift() ?? fallback;
    if (response instanceof Error) throw response;
    return response;
  }
}

/** Replaces the placeholder with a marker so tests can assert the XML was signed. */
export class FakeSigner implements XmlSignerPort {
  signed = 0;
  async sign(xml: string): Promise<string> {
    this.signed++;
    return xml.replace(SIGNATURE_PLACEHOLDER, '<ds:Signature/>');
  }
}

export class FakeCertificateStore implements CertificateStorePort {
  constructor(
    public info: CertificateInfo | null = {
      subject: 'CN=Prueba',
      issuer: 'CN=Prueba',
      serialNumber: '1',
      validFrom: new Date('2025-01-01T00:00:00Z'),
      validTo: new Date('2030-01-01T00:00:00Z'),
    },
  ) {}
  async describe(): Promise<CertificateInfo | null> {
    return this.info;
  }
}

export class FakeUblBuilder implements UblDocumentBuilderPort {
  readonly inputs: UblBuildInput[] = [];
  build(input: UblBuildInput): string {
    this.inputs.push(input);
    return `<Doc number="${input.document.number}" cufe="${input.uniqueCode}">${SIGNATURE_PLACEHOLDER}</Doc>`;
  }
}

export class FakeAttachedDocumentBuilder implements AttachedDocumentBuilderPort {
  build(): string {
    return `<AttachedDocument>${SIGNATURE_PLACEHOLDER}</AttachedDocument>`;
  }
}

export class FakeZipArchiver implements ZipArchiverPort {
  zip(entryName: string, content: string | Buffer): Buffer {
    return Buffer.from(`${entryName}:${content.toString()}`);
  }
}

/** Collects background tasks; `flush` runs them (deterministic tests). */
export class ManualExecutor implements BackgroundExecutorPort {
  readonly tasks: { name: string; task: () => Promise<unknown> }[] = [];
  run(name: string, task: () => Promise<unknown>): void {
    this.tasks.push({ name, task });
  }
  async flush(): Promise<void> {
    while (this.tasks.length) await this.tasks.shift()!.task();
  }
}

/** Student/guardian links and student payments configured by the test. */
export class InMemoryPortalStudentLinks implements PortalStudentLinksPort {
  /** `userId` → linked student ids. */
  readonly links = new Map<number, number[]>();
  /** `studentId` → payment ids. */
  readonly payments = new Map<number, number[]>();

  async studentIdsLinkedTo(user: PortalUser): Promise<number[]> {
    return this.links.get(user.userId) ?? [];
  }

  async paymentIdsOfStudent(studentId: number): Promise<number[]> {
    return this.payments.get(studentId) ?? [];
  }
}

/** Records the render requests and returns a fake PDF. */
export class FakeInvoicePdfRenderer implements InvoicePdfRendererPort {
  readonly inputs: InvoicePdfInput[] = [];

  async render(input: InvoicePdfInput): Promise<DocumentArtifact> {
    this.inputs.push(input);
    return { fileName: `${input.document.number}.pdf`, contentType: 'application/pdf', content: Buffer.from('%PDF-') };
  }
}
