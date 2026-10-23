import { Amounts } from '../../domain/amounts.js';
import type { TaxTreatment } from '../../domain/catalogs.js';
import type { DianOperation } from '../../domain/dian-response.js';
import { DocumentLine } from '../../domain/document-line.js';
import { type DianSubmission, type DocumentStatus, ElectronicDocument } from '../../domain/electronic-document.js';
import { Party } from '../../domain/party.js';
import { DianSubmissionOrmEntity } from './dian-submission.orm-entity.js';
import { ElectronicDocumentOrmEntity } from './electronic-document.orm-entity.js';

/** JSON stored in `lines_data`: legacy keys plus `tax_treatment`. */
interface StoredLine {
  description: string;
  product_code?: string | null;
  quantity: number | string;
  unit_price: number | string;
  line_total?: number | string;
  tax_percent?: number | string | null;
  tax_amount?: number | string;
  tax_treatment?: TaxTreatment;
}

/** Legacy statuses still present in old rows. */
const LEGACY_STATUS: Record<string, DocumentStatus> = { pending: 'draft', sent: 'submitted', error: 'send_error' };

/** `jsonb` values arrive parsed; a JSON string (double-encoded legacy row) is parsed defensively. */
const fromJson = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

/** Translates between `dian_invoices` (+ submissions) and {@link ElectronicDocument}. */
export const ElectronicDocumentMapper = {
  toDomain(row: ElectronicDocumentOrmEntity, submissions: DianSubmissionOrmEntity[] = []): ElectronicDocument {
    const messages = fromJson<{ errors?: string[]; notices?: string[] }>(row.dianErrors, {});
    const reference =
      row.refInvoiceNumber && row.refCufe
        ? {
            documentId: row.refDocumentId,
            number: row.refInvoiceNumber,
            uniqueCode: row.refCufe,
            issueDate: row.refIssueDate ?? '',
          }
        : null;
    return ElectronicDocument.restore(row.id, {
      type: row.invoiceType,
      prefix: row.prefix,
      consecutive: Number(row.consecutive),
      cycle: Number(row.numberingCycle ?? 0),
      number: row.invoiceNumber,
      environment: row.environment ?? '2',
      issueDate: row.issueDate,
      issueTime: row.issueTime ?? '00:00:00-05:00',
      customer: Party.restore({
        name: row.customerName,
        idType: row.customerIdType,
        idNumber: row.customerIdNumber,
        email: row.customerEmail,
        phone: row.customerPhone,
        address: row.customerAddress,
        location: {
          cityCode: row.customerCityCode ?? '11001',
          cityName: row.customerCity ?? 'Bogotá, D.C.',
          departmentCode: row.customerDepartmentCode ?? '11',
          departmentName: row.customerDepartment ?? 'Bogotá',
        },
        taxLevelCode: 'R-99-PN',
        vatRegime: '49',
      }),
      lines: fromJson<StoredLine[]>(row.linesData, []).map(toLine),
      paymentMeans: { form: row.paymentForm ?? '1', code: row.paymentMeansCode ?? '10', dueDate: row.paymentDueDate },
      notes: row.notes,
      billingReference: reference,
      discrepancy: row.discrepancyCode
        ? { code: row.discrepancyCode, description: row.discrepancyDescription ?? '' }
        : null,
      sourcePaymentId: row.sourcePaymentId,
      uniqueCode: row.cufe,
      securityCode: row.softwareSecurityCode,
      qrUrl: row.qrUrl,
      fileNames: row.xmlFilename
        ? {
            xml: row.xmlFilename.replace(/\.xml$/, ''),
            zip: (row.zipFilename ?? row.xmlFilename).replace(/\.(xml|zip)$/, ''),
          }
        : null,
      signedXml: row.xmlContent,
      status: LEGACY_STATUS[row.dianStatus] ?? (row.dianStatus as DocumentStatus),
      operation: (row.dianOperation as DianOperation | null) ?? null,
      trackId: row.dianTrackId,
      statusCode: row.dianResponseCode,
      statusMessage: row.dianResponseMessage,
      errors: messages.errors ?? [],
      notices: messages.notices ?? [],
      applicationResponse: row.applicationResponse,
      attachedDocument: row.attachedDocument,
      attempts: Number(row.submissionAttempts ?? 0),
      lastSubmissionAt: row.lastSubmissionAt,
      submissions: submissions.map(toSubmission),
      createdAt: row.createdAt,
    });
  },

  toPersistence(document: ElectronicDocument): ElectronicDocumentOrmEntity {
    const row = new ElectronicDocumentOrmEntity();
    if (document.id !== null) row.id = document.id;
    const totals = document.totals;
    const customer = document.customer;
    Object.assign(row, {
      invoiceNumber: document.number,
      prefix: document.prefix,
      consecutive: document.consecutive,
      numberingCycle: document.cycle,
      invoiceType: document.type,
      environment: document.environment,
      sourcePaymentId: document.sourcePaymentId,
      cufe: document.uniqueCode,
      softwareSecurityCode: document.securityCode,
      qrUrl: document.qrUrl,
      customerName: customer.name,
      customerIdType: customer.idType,
      customerIdNumber: customer.idNumber,
      customerDv: customer.dv,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerCity: customer.location.cityName,
      customerCityCode: customer.location.cityCode,
      customerDepartment: customer.location.departmentName,
      customerDepartmentCode: customer.location.departmentCode,
      subtotal: Amounts.format(totals.lineExtensionCents),
      taxAmount: Amounts.format(totals.taxCents),
      total: Amounts.format(totals.payableCents),
      paymentMeansCode: document.paymentMeans.code,
      paymentForm: document.paymentMeans.form,
      paymentDueDate: document.paymentMeans.dueDate,
      refDocumentId: document.billingReference?.documentId ?? null,
      refInvoiceNumber: document.billingReference?.number ?? null,
      refCufe: document.billingReference?.uniqueCode ?? null,
      refIssueDate: document.billingReference?.issueDate ?? null,
      discrepancyCode: document.discrepancy?.code ?? null,
      discrepancyDescription: document.discrepancy?.description ?? null,
      xmlFilename: document.fileNames ? `${document.fileNames.xml}.xml` : null,
      zipFilename: document.fileNames ? `${document.fileNames.zip}.zip` : null,
      xmlContent: document.signedXml,
      linesData: document.lines.map(fromLine),
      issueDate: document.issueDate,
      issueTime: document.issueTime,
      notes: document.notes,
      dianStatus: document.status,
      dianResponse: document.applicationResponse,
      dianResponseCode: document.statusCode,
      dianResponseMessage: [document.statusMessage, ...document.errors].filter(Boolean).join(' | ') || null,
      dianTrackId: document.trackId,
      dianOperation: document.operation,
      dianErrors: { errors: [...document.errors], notices: [...document.notices] },
      applicationResponse: document.applicationResponse,
      attachedDocument: document.attachedDocument,
      submissionAttempts: document.attempts,
      lastSubmissionAt: document.lastSubmissionAt,
    } satisfies Partial<ElectronicDocumentOrmEntity>);
    return row;
  },

  /** Rows for the submissions not persisted yet. */
  newSubmissions(document: ElectronicDocument): DianSubmissionOrmEntity[] {
    return document.submissions
      .filter((submission) => submission.id === null)
      .map((submission) =>
        Object.assign(new DianSubmissionOrmEntity(), {
          documentId: document.id as number,
          operation: submission.operation,
          outcome: submission.outcome,
          statusCode: submission.statusCode,
          statusMessage: submission.statusMessage,
          errors: [...submission.errors],
          trackId: submission.trackId,
          createdAt: submission.at,
        }),
      );
  },
};

function toLine(stored: StoredLine): DocumentLine {
  const rate = Amounts.toScaled(stored.tax_percent ?? 0, 2, 'tarifa');
  return DocumentLine.restore({
    description: stored.description,
    code: stored.product_code ?? '',
    quantityHundredths: Amounts.toScaled(stored.quantity, 2, 'cantidad'),
    unitPriceCents: Amounts.toScaled(stored.unit_price, 2, 'precio'),
    taxTreatment: stored.tax_treatment ?? (rate > 0 ? 'taxed' : 'exempt'),
    taxRateBasisPoints: rate,
  });
}

function fromLine(line: DocumentLine): StoredLine {
  return {
    description: line.description,
    product_code: line.code,
    quantity: Amounts.format(line.quantityHundredths),
    unit_price: Amounts.format(line.unitPriceCents),
    line_total: Amounts.format(line.lineTotalCents),
    tax_percent: Amounts.format(line.taxRateBasisPoints),
    tax_amount: Amounts.format(line.taxCents),
    tax_treatment: line.taxTreatment,
  };
}

function toSubmission(row: DianSubmissionOrmEntity): DianSubmission {
  return {
    id: row.id,
    operation: row.operation as DianOperation,
    outcome: row.outcome as DianSubmission['outcome'],
    statusCode: row.statusCode,
    statusMessage: row.statusMessage,
    errors: fromJson<string[]>(row.errors, []),
    trackId: row.trackId,
    at: row.createdAt,
  };
}
