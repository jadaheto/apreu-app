import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { Expense } from '../../domain/expense.js';
import type { ExpenseRepository, ExpenseSearchCriteria } from '../../domain/expense.repository.js';
import { ExpenseOrmEntity } from './expense.orm-entity.js';
import { ExpenseMapper } from './finance.mappers.js';
import { likePattern } from './sql.js';

@Injectable()
export class TypeOrmExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Expense | null> {
    const row = await (await this.db.repository(ExpenseOrmEntity)).findOneBy({ id });
    return row ? ExpenseMapper.toDomain(row) : null;
  }

  async existsByReceiptNo(receiptNo: string): Promise<boolean> {
    return (await (await this.db.repository(ExpenseOrmEntity)).countBy({ receiptNo })) > 0;
  }

  async search(criteria: ExpenseSearchCriteria, page: PageRequest): Promise<Paginated<Expense>> {
    const query = (await this.db.repository(ExpenseOrmEntity)).createQueryBuilder('e');
    if (criteria.from) query.andWhere('e.expense_date >= :from', { from: criteria.from });
    if (criteria.to) query.andWhere('e.expense_date <= :to', { to: criteria.to });
    if (criteria.categoryId) query.andWhere('e.category_id = :categoryId', { categoryId: criteria.categoryId });
    if (criteria.search?.trim()) {
      const term = likePattern(criteria.search);
      query.andWhere(
        new Brackets((q) =>
          q
            .where('f_unaccent(e.description) ILIKE f_unaccent(:term)', { term })
            .orWhere('f_unaccent(e.vendor) ILIKE f_unaccent(:term)', { term })
            .orWhere('f_unaccent(e.receipt_no) ILIKE f_unaccent(:term)', { term }),
        ),
      );
    }
    const [rows, total] = await query
      .orderBy('e.expense_date', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(ExpenseMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async save(expense: Expense): Promise<void> {
    const saved = await (await this.db.repository(ExpenseOrmEntity)).save(ExpenseMapper.toPersistence(expense));
    if (expense.isNew) expense.assignId(saved.id);
  }
}
