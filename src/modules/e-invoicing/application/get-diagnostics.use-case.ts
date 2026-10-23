import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { toBogota } from '../domain/bogota-time.js';
import type { DocumentType } from '../domain/catalogs.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import type { IssuerConfig } from '../domain/issuer-config.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import type { NumberingResolution } from '../domain/numbering-resolution.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import { CERTIFICATE_STORE, type CertificateInfo, type CertificateStorePort } from './ports/certificate-store.port.js';

export type CheckSeverity = 'ok' | 'warning' | 'error';

export interface DiagnosticCheck {
  code: string;
  severity: CheckSeverity;
  message: string;
}

export interface DiagnosticsView {
  ready: boolean;
  checks: DiagnosticCheck[];
}

const DAY_MS = 86_400_000;
const CERTIFICATE_WARNING_DAYS = 30;
const LOW_RANGE_THRESHOLD = 100;
const TYPE_NAMES: Record<DocumentType, string> = { fv: 'facturas', nc: 'notas crédito', nd: 'notas débito' };

/**
 * Configuration checks before issuing (legacy `finance/dian_diagnostic.php`,
 * without exposing secrets): required data, certificate validity, numbering
 * ranges per type and environment consistency (prevents FAD05e/FAD06).
 */
@Injectable()
export class GetDiagnosticsUseCase implements UseCase<void, DiagnosticsView> {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(CERTIFICATE_STORE) private readonly certificates: CertificateStorePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<DiagnosticsView> {
    const config = await this.configs.get();
    const certificate = await this.certificates.describe().catch((error: Error) => error);
    const checks: DiagnosticCheck[] = [
      ...this.configChecks(config),
      this.certificateCheck(certificate),
      ...(await Promise.all(
        (['fv', 'nc', 'nd'] as const).map(async (type) =>
          this.resolutionCheck(type, config, await this.resolutions.findActive(type)),
        ),
      )),
      ...(await this.pendingCheck()),
    ];
    return { ready: checks.every((check) => check.severity !== 'error'), checks };
  }

  private configChecks(config: IssuerConfig): DiagnosticCheck[] {
    const missing = config.missingFields();
    const checks: DiagnosticCheck[] = [
      missing.length
        ? { code: 'CONFIG_INCOMPLETE', severity: 'error', message: `Faltan datos obligatorios: ${missing.join(', ')}.` }
        : {
            code: 'CONFIG_COMPLETE',
            severity: 'ok',
            message: `Emisor ${config.businessName} NIT ${config.nit}-${config.dv}.`,
          },
    ];
    if (config.environment === '2' && !config.testSetId) {
      checks.push({
        code: 'TEST_SET_ID_MISSING',
        severity: 'warning',
        message: 'Ambiente de habilitación sin TestSetId: se usará SendBillSync.',
      });
    }
    if (config.environment === '1' && config.testSetId) {
      checks.push({
        code: 'TEST_SET_ID_IGNORED',
        severity: 'warning',
        message: 'En producción el TestSetId se ignora.',
      });
    }
    return checks;
  }

  private certificateCheck(certificate: CertificateInfo | null | Error): DiagnosticCheck {
    if (certificate instanceof Error)
      return { code: 'CERTIFICATE_INVALID', severity: 'error', message: certificate.message };
    if (!certificate)
      return {
        code: 'CERTIFICATE_MISSING',
        severity: 'error',
        message: 'No hay certificado de firma digital configurado.',
      };
    const now = this.clock.now().getTime();
    const days = Math.floor((certificate.validTo.getTime() - now) / DAY_MS);
    if (now < certificate.validFrom.getTime() || days < 0) {
      return {
        code: 'CERTIFICATE_EXPIRED',
        severity: 'error',
        message: 'El certificado de firma digital no está vigente.',
      };
    }
    return days <= CERTIFICATE_WARNING_DAYS
      ? { code: 'CERTIFICATE_EXPIRING', severity: 'warning', message: `El certificado vence en ${days} días.` }
      : {
          code: 'CERTIFICATE_OK',
          severity: 'ok',
          message: `Certificado de ${certificate.subject} vigente por ${days} días.`,
        };
  }

  private resolutionCheck(
    type: DocumentType,
    config: IssuerConfig,
    resolution: NumberingResolution | null,
  ): DiagnosticCheck {
    const code = `RESOLUTION_${type.toUpperCase()}`;
    const name = TYPE_NAMES[type];
    if (!resolution) {
      return {
        code: `${code}_MISSING`,
        severity: type === 'fv' ? 'error' : 'warning',
        message: `No hay numeración activa para ${name}.`,
      };
    }
    if (resolution.environment !== config.environment) {
      return {
        code: `${code}_ENVIRONMENT`,
        severity: 'error',
        message: `La numeración de ${name} es de otro ambiente DIAN.`,
      };
    }
    const today = toBogota(this.clock.now()).date;
    if ((resolution.validTo && today > resolution.validTo) || (resolution.validFrom && today < resolution.validFrom)) {
      return { code: `${code}_EXPIRED`, severity: 'error', message: `La resolución de ${name} no está vigente hoy.` };
    }
    if (resolution.remaining <= 0)
      return { code: `${code}_EXHAUSTED`, severity: 'error', message: `Se agotó el rango de ${name}.` };
    if (resolution.remaining < LOW_RANGE_THRESHOLD) {
      return {
        code: `${code}_LOW`,
        severity: 'warning',
        message: `Quedan ${resolution.remaining} números para ${name}.`,
      };
    }
    return {
      code: `${code}_OK`,
      severity: 'ok',
      message: `Prefijo ${resolution.prefix}: quedan ${resolution.remaining} números.`,
    };
  }

  private async pendingCheck(): Promise<DiagnosticCheck[]> {
    const pending = await this.documents.findPendingSubmission(1);
    return pending.length
      ? [
          {
            code: 'PENDING_SUBMISSIONS',
            severity: 'warning',
            message: 'Hay documentos firmados sin enviar o con error de envío.',
          },
        ]
      : [];
  }
}
