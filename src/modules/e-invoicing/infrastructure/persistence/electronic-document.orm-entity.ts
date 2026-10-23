import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { DocumentStatus } from '../../domain/electronic-document.js';

const decimal = { to: (value: string) => value, from: (value: string | null) => value ?? '0.00' };

/** Mapping of `dian_invoices` (+ migration e-invoicing-001). */
@Entity({ name: 'dian_invoices' })
export class ElectronicDocumentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'order_id', type: 'integer', nullable: true })
  orderId: number | null;

  @Column({ name: 'source_payment_id', type: 'integer', nullable: true })
  sourcePaymentId: number | null;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 10 })
  prefix: string;

  @Column({ type: 'integer' })
  consecutive: number;

  @Column({ name: 'numbering_cycle', type: 'integer', default: 0 })
  numberingCycle: number;

  @Column({ name: 'invoice_type', type: 'varchar', length: 10, default: 'fv' })
  invoiceType: 'fv' | 'nd' | 'nc';

  @Column({ type: 'varchar', length: 10, nullable: true })
  environment: '1' | '2' | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  cufe: string | null;

  @Column({ name: 'software_security_code', type: 'varchar', length: 100, nullable: true })
  softwareSecurityCode: string | null;

  @Column({ name: 'qr_url', type: 'varchar', length: 500, nullable: true })
  qrUrl: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255 })
  customerName: string;

  @Column({ name: 'customer_id_type', type: 'varchar', length: 5 })
  customerIdType: string;

  @Column({ name: 'customer_id_number', type: 'varchar', length: 30 })
  customerIdNumber: string;

  @Column({ name: 'customer_dv', type: 'varchar', length: 2, nullable: true })
  customerDv: string | null;

  @Column({ name: 'customer_email', type: 'varchar', length: 200, nullable: true })
  customerEmail: string | null;

  @Column({ name: 'customer_phone', type: 'varchar', length: 30, nullable: true })
  customerPhone: string | null;

  @Column({ name: 'customer_address', type: 'text', nullable: true })
  customerAddress: string | null;

  @Column({ name: 'customer_city', type: 'varchar', length: 100, nullable: true })
  customerCity: string | null;

  @Column({ name: 'customer_city_code', type: 'varchar', length: 10, nullable: true })
  customerCityCode: string | null;

  @Column({ name: 'customer_department', type: 'varchar', length: 100, nullable: true })
  customerDepartment: string | null;

  @Column({ name: 'customer_department_code', type: 'varchar', length: 5, nullable: true })
  customerDepartmentCode: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: decimal })
  subtotal: string;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: decimal })
  taxAmount: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: decimal })
  total: string;

  @Column({ name: 'payment_means_code', type: 'varchar', length: 5, nullable: true })
  paymentMeansCode: string | null;

  @Column({ name: 'payment_form', type: 'varchar', length: 10, default: '1' })
  paymentForm: '1' | '2';

  @Column({ name: 'payment_due_date', type: 'date', nullable: true })
  paymentDueDate: string | null;

  @Column({ name: 'ref_document_id', type: 'integer', nullable: true })
  refDocumentId: number | null;

  @Column({ name: 'ref_invoice_number', type: 'varchar', length: 50, nullable: true })
  refInvoiceNumber: string | null;

  @Column({ name: 'ref_cufe', type: 'varchar', length: 200, nullable: true })
  refCufe: string | null;

  @Column({ name: 'ref_issue_date', type: 'date', nullable: true })
  refIssueDate: string | null;

  @Column({ name: 'discrepancy_code', type: 'varchar', length: 2, nullable: true })
  discrepancyCode: string | null;

  @Column({ name: 'discrepancy_description', type: 'varchar', length: 255, nullable: true })
  discrepancyDescription: string | null;

  @Column({ name: 'xml_filename', type: 'varchar', length: 255, nullable: true })
  xmlFilename: string | null;

  @Column({ name: 'zip_filename', type: 'varchar', length: 255, nullable: true })
  zipFilename: string | null;

  @Column({ name: 'xml_content', type: 'text', nullable: true })
  xmlContent: string | null;

  /** JSON array of lines (legacy keys, see `ElectronicDocumentMapper`). */
  @Column({ name: 'lines_data', type: 'jsonb', nullable: true })
  linesData: unknown[] | null;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'issue_time', type: 'varchar', length: 20, nullable: true })
  issueTime: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'dian_status',
    type: 'varchar',
    length: 30,
    default: 'draft',
  })
  dianStatus: DocumentStatus | 'pending' | 'sent' | 'error';

  @Column({ name: 'dian_response', type: 'text', nullable: true })
  dianResponse: string | null;

  @Column({ name: 'dian_response_code', type: 'varchar', length: 10, nullable: true })
  dianResponseCode: string | null;

  @Column({ name: 'dian_response_message', type: 'text', nullable: true })
  dianResponseMessage: string | null;

  @Column({ name: 'dian_track_id', type: 'varchar', length: 200, nullable: true })
  dianTrackId: string | null;

  @Column({ name: 'dian_operation', type: 'varchar', length: 30, nullable: true })
  dianOperation: string | null;

  @Column({ name: 'dian_errors', type: 'jsonb', nullable: true })
  dianErrors: { errors?: string[]; notices?: string[] } | null;

  @Column({ name: 'application_response', type: 'text', nullable: true })
  applicationResponse: string | null;

  @Column({ name: 'attached_document', type: 'text', nullable: true })
  attachedDocument: string | null;

  @Column({ name: 'submission_attempts', type: 'integer', default: 0 })
  submissionAttempts: number;

  @Column({ name: 'last_submission_at', type: 'timestamptz', nullable: true })
  lastSubmissionAt: Date | null;

  @Column({ name: 'email_sent', type: 'boolean', default: false })
  emailSent: boolean;

  @Column({ name: 'email_sent_at', type: 'timestamptz', nullable: true })
  emailSentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
