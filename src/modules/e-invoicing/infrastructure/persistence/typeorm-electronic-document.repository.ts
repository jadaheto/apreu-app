import { Injectable } from '@nestjs/common';
import { Brackets, In, type SelectQueryBuilder } from 'typeorm';
import { toOffset, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { Amounts } from '../../domain/amounts.js';
import type { DocumentType } from '../../domain/catalogs.js';
import type { DocumentStatus, ElectronicDocument } from '../../domain/electronic-document.js';
import type {
  DocumentCounts,
  DocumentSearchCriteria,
  DocumentStats,
  ElectronicDocumentRepository,
} from '../../domain/electronic-document.repository.js';
import { DianSubmissionOrmEntity } from './dian-submission.orm-entity.js';
import { ElectronicDocumentMapper } from './electronic-document.mapper.js';
import { ElectronicDocumentOrmEntity } from './electronic-document.orm-entity.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';

const emptyCounts = (): DocumentCounts => ({ fv: {}, nc: {}, nd: {} });

@Injectable()
export class TypeOrmElectronicDocumentRepository implements ElectronicDocumentRepository {
  constructor(private readonly db: TenantDataSource) {}

  async markEmailSent(id: number, sentAt: Date): Promise<void> {
    await (
      await this.db.repository(ElectronicDocumentOrmEntity)
    ).update({ id }, { emailSent: true, emailSentAt: sentAt });
  }

  async findById(id: number): Promise<ElectronicDocument | null> {
    const row = await (await this.db.repository(ElectronicDocumentOrmEntity)).findOneBy({ id });
    if (!row) return null;
    const submissions = await (
      await this.db.repository(DianSubmissionOrmEntity)
    ).find({
      where: { documentId: id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return ElectronicDocumentMapper.toDomain(row, submissions);
  }

  async findBySourcePayment(paymentId: number, type: DocumentType): Promise<ElectronicDocument[]> {
    const rows = await (
      await this.db.repository(ElectronicDocumentOrmEntity)
    ).find({
      where: { sourcePaymentId: paymentId, invoiceType: type },
      order: { id: 'ASC' },
    });
    return rows.map((row) => ElectronicDocumentMapper.toDomain(row));
  }

  async search(criteria: DocumentSearchCriteria, page: PageRequest): Promise<Paginated<ElectronicDocument>> {
    if (criteria.sourcePaymentIds?.length === 0) return { items: [], total: 0, page: page.page, limit: page.limit };
    const query = this.filtered(await this.queryBuilder(), criteria);
    if (criteria.type) query.andWhere('d.invoice_type = :type', { type: criteria.type });
    if (criteria.status) query.andWhere('d.dian_status = :status', { status: criteria.status });
    if (criteria.sourcePaymentIds) {
      query.andWhere('d.source_payment_id IN (:...paymentIds)', { paymentIds: [...criteria.sourcePaymentIds] });
    }
    if (criteria.excludeStatuses?.length) {
      query.andWhere('d.dian_status NOT IN (:...excluded)', { excluded: [...criteria.excludeStatuses] });
    }
    if (criteria.search) {
      const term = `%${criteria.search.trim()}%`;
      query.andWhere(
        new Brackets((q) =>
          q
            .where('d.invoice_number ILIKE :term', { term })
            .orWhere(unaccentLike('d.customer_name', ':term'), { term })
            .orWhere(unaccentLike('d.customer_id_number', ':term'), { term }),
        ),
      );
    }
    const [rows, total] = await query.orderBy('d.id', 'DESC').skip(toOffset(page)).take(page.limit).getManyAndCount();
    return {
      items: rows.map((row) => ElectronicDocumentMapper.toDomain(row)),
      total,
      page: page.page,
      limit: page.limit,
    };
  }

  async stats(criteria: Pick<DocumentSearchCriteria, 'from' | 'to'>): Promise<DocumentStats> {
    const counts = await this.countBy(this.filtered(await this.queryBuilder(), criteria));
    const accepted = await this.filtered(await this.queryBuilder(), criteria)
      .select('COALESCE(SUM(d.total), 0)', 'total')
      .andWhere("d.invoice_type = 'fv'")
      .andWhere('d.dian_status IN (:...statuses)', { statuses: ['accepted', 'accepted_with_notices'] })
      .getRawOne<{ total: string }>();
    return { counts, acceptedInvoicesTotalCents: Amounts.toScaled(accepted?.total ?? '0', 2, 'total') };
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocument[]> {
    const rows = await (
      await this.db.repository(ElectronicDocumentOrmEntity)
    ).find({
      where: { dianStatus: In(['signed', 'send_error']) },
      order: { id: 'ASC' },
      take: limit,
    });
    return rows.map((row) => ElectronicDocumentMapper.toDomain(row));
  }

  async creditedTotalCents(invoiceId: number): Promise<number> {
    const result = await (
      await this.queryBuilder()
    )
      .select('COALESCE(SUM(d.total), 0)', 'total')
      .where("d.invoice_type = 'nc' AND d.ref_document_id = :invoiceId AND d.dian_status <> 'rejected'", { invoiceId })
      .getRawOne<{ total: string }>();
    return Amounts.toScaled(result?.total ?? '0', 2, 'total');
  }

  async testSetCounts(): Promise<DocumentCounts> {
    return this.countBy((await this.queryBuilder()).where("d.dian_operation = 'SendTestSetAsync'"));
  }

  async save(document: ElectronicDocument): Promise<void> {
    await this.db.runInTransaction(async () => {
      const saved = await (
        await this.db.repository(ElectronicDocumentOrmEntity)
      ).save(ElectronicDocumentMapper.toPersistence(document));
      if (document.isNew) document.assignId(saved.id);
      const submissions = ElectronicDocumentMapper.newSubmissions(document);
      if (submissions.length === 0) return;
      const inserted = await (await this.db.repository(DianSubmissionOrmEntity)).save(submissions);
      document.assignSubmissionIds(inserted.map((row) => row.id));
    });
  }

  private async queryBuilder(): Promise<SelectQueryBuilder<ElectronicDocumentOrmEntity>> {
    return (await this.db.repository(ElectronicDocumentOrmEntity)).createQueryBuilder('d');
  }

  private filtered(
    query: SelectQueryBuilder<ElectronicDocumentOrmEntity>,
    criteria: Pick<DocumentSearchCriteria, 'from' | 'to'>,
  ): SelectQueryBuilder<ElectronicDocumentOrmEntity> {
    if (criteria.from) query.andWhere('d.issue_date >= :from', { from: criteria.from });
    if (criteria.to) query.andWhere('d.issue_date <= :to', { to: criteria.to });
    return query;
  }

  private async countBy(query: SelectQueryBuilder<ElectronicDocumentOrmEntity>): Promise<DocumentCounts> {
    const rows = await query
      .select('d.invoice_type', 'type')
      .addSelect('d.dian_status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('d.invoice_type')
      .addGroupBy('d.dian_status')
      .getRawMany<{ type: DocumentType; status: DocumentStatus; count: string }>();
    const counts = emptyCounts();
    rows.forEach((row) => (counts[row.type][row.status] = Number(row.count)));
    return counts;
  }
}
