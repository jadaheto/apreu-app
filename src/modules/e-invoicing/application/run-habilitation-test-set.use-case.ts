import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import type { DocumentType } from '../domain/catalogs.js';
import { DocumentLine } from '../domain/document-line.js';
import type { ElectronicDocument } from '../domain/electronic-document.js';
import type { IssuerConfig } from '../domain/issuer-config.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import { BACKGROUND_EXECUTOR, type BackgroundExecutorPort } from './ports/background-executor.port.js';
import { type CustomerInput, toCustomerParty } from './services/document-inputs.js';
import { DocumentIssuer } from './services/document-issuer.js';
import { DocumentSubmitter } from './services/document-submitter.js';
import { discrepancyFor, referenceTo } from './services/referenced-invoice.js';

/** Number of documents of each type requested by the DIAN test set (assigned in the DIAN portal). */
export interface TestSetPlan {
  invoices: number;
  creditNotes: number;
  debitNotes: number;
}

/** Fictitious acquirers of the habilitation set (legacy `finance/dian_tests.php`). */
const TEST_CUSTOMERS: readonly CustomerInput[] = [
  {
    name: 'Distribuidora Educativa del Caribe SAS',
    idType: '31',
    idNumber: '900123456',
    email: 'facturas@example.com',
  },
  { name: 'Papelería Escolar El Saber SAS', idType: '31', idNumber: '800987654', email: 'compras@example.com' },
  { name: 'Fundación Amigos de la Lectura', idType: '31', idNumber: '900555111', email: 'contabilidad@example.com' },
  {
    name: 'María Fernanda Gómez Ruiz',
    idType: '13',
    idNumber: '1065432198',
    email: 'maria.gomez@example.com',
    firstName: 'María Fernanda',
    familyName: 'Gómez Ruiz',
  },
  {
    name: 'Carlos Andrés Pérez Díaz',
    idType: '13',
    idNumber: '1102345678',
    email: 'carlos.perez@example.com',
    firstName: 'Carlos Andrés',
    familyName: 'Pérez Díaz',
  },
];

/** Excluded educational services plus one VAT-taxed item, so the set covers both tax paths. */
const TEST_ITEMS = [
  { description: 'Pensión escolar', code: 'PEN', unitPrice: 350000, taxTreatment: 'excluded' as const },
  { description: 'Uniforme deportivo', code: 'UNI', unitPrice: 85000, taxTreatment: 'taxed' as const, taxRate: 19 },
  { description: 'Matrícula', code: 'MAT', unitPrice: 480000, taxTreatment: 'excluded' as const },
  { description: 'Transporte escolar', code: 'TRA', unitPrice: 120000, taxTreatment: 'excluded' as const },
];

const MAX_PER_TYPE = 100;

/**
 * Generates and sends the habilitation test set (`SendTestSetAsync`): first
 * the invoices, then credit and debit notes referencing them. The amounts per
 * type are parameters (the legacy hard-coded 30/10/10). Runs in background;
 * progress is read with {@link GetTestSetProgressUseCase}.
 */
@Injectable()
export class RunHabilitationTestSetUseCase implements UseCase<TestSetPlan, TestSetPlan> {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(BACKGROUND_EXECUTOR) private readonly background: BackgroundExecutorPort,
    private readonly issuer: DocumentIssuer,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(plan: TestSetPlan): Promise<TestSetPlan> {
    const config = await this.configs.get();
    if (!config.usesTestSet) {
      throw new BusinessRuleViolationError(
        'El set de pruebas requiere ambiente de habilitación y TestSetId configurado.',
        'TEST_SET_NOT_CONFIGURED',
      );
    }
    for (const value of Object.values(plan)) {
      if (!Number.isInteger(value) || value < 0 || value > MAX_PER_TYPE) {
        throw new BusinessRuleViolationError(
          `Cada cantidad debe estar entre 0 y ${MAX_PER_TYPE}.`,
          'INVALID_TEST_SET_PLAN',
        );
      }
    }
    if (plan.invoices === 0 && plan.creditNotes + plan.debitNotes > 0) {
      throw new BusinessRuleViolationError(
        'Las notas del set de pruebas requieren facturas en la misma ejecución.',
        'INVALID_TEST_SET_PLAN',
      );
    }
    const needed: DocumentType[] = (['fv', 'nc', 'nd'] as const).filter(
      (type) => ({ fv: plan.invoices, nc: plan.creditNotes, nd: plan.debitNotes })[type] > 0,
    );
    for (const type of needed) {
      if (!(await this.resolutions.findActive(type))) {
        throw new BusinessRuleViolationError(`Falta la numeración activa del tipo "${type}".`, 'NO_ACTIVE_RESOLUTION');
      }
    }
    this.background.run('dian-test-set', () => this.run(plan, config));
    return plan;
  }

  private async run(plan: TestSetPlan, config: IssuerConfig): Promise<void> {
    const invoices: ElectronicDocument[] = [];
    for (let i = 0; i < plan.invoices; i++) {
      const item = TEST_ITEMS[i % TEST_ITEMS.length];
      const document = await this.issuer.issue({
        type: 'fv',
        customer: toCustomerParty(TEST_CUSTOMERS[i % TEST_CUSTOMERS.length], config),
        lines: [DocumentLine.create({ ...item, quantity: (i % 3) + 1 })],
        paymentMeans: { form: '1', code: '10', dueDate: null },
        notes: `Set de pruebas de habilitación #${i + 1}`,
      });
      invoices.push(await this.submitter.submit(document));
    }
    const referenceable = invoices.filter((invoice) => invoice.isReferenceable);
    if (referenceable.length === 0) return;

    for (let i = 0; i < plan.creditNotes; i++) {
      const invoice = referenceable[i % referenceable.length];
      const line = invoice.lines[0];
      await this.issueNote(
        'nc',
        invoice,
        '1',
        DocumentLine.create({
          description: `Devolución parcial: ${line.description}`,
          code: line.code,
          quantity: 1,
          unitPrice: Math.max(1, Math.floor(line.unitPriceCents / 200)),
          taxTreatment: line.taxTreatment,
          taxRate: line.taxRateBasisPoints / 100,
        }),
      );
    }
    for (let i = 0; i < plan.debitNotes; i++) {
      const invoice = referenceable[i % referenceable.length];
      await this.issueNote(
        'nd',
        invoice,
        '1',
        DocumentLine.create({ description: 'Intereses de mora', code: 'INT', quantity: 1, unitPrice: 15000 }),
      );
    }
  }

  private async issueNote(
    type: 'nc' | 'nd',
    invoice: ElectronicDocument,
    concept: string,
    line: DocumentLine,
  ): Promise<void> {
    const document = await this.issuer.issue({
      type,
      customer: invoice.customer,
      lines: [line],
      paymentMeans: { ...invoice.paymentMeans },
      billingReference: referenceTo(invoice),
      discrepancy: discrepancyFor(type, concept),
    });
    await this.submitter.submit(document);
  }
}
