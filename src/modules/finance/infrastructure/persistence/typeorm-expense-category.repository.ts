import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ExpenseCategory } from '../../domain/expense-category.js';
import type { ExpenseCategoryRepository } from '../../domain/expense-category.repository.js';
import { ExpenseCategoryOrmEntity } from './expense-category.orm-entity.js';
import { ExpenseMapper } from './finance.mappers.js';

@Injectable()
export class TypeOrmExpenseCategoryRepository implements ExpenseCategoryRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<ExpenseCategory | null> {
    const row = await (await this.db.repository(ExpenseCategoryOrmEntity)).findOneBy({ id });
    return row ? ExpenseMapper.categoryToDomain(row) : null;
  }

  async findByName(name: string): Promise<ExpenseCategory | null> {
    const row = await (
      await this.db.repository(ExpenseCategoryOrmEntity)
    )
      .createQueryBuilder('c')
      .where('lower(f_unaccent(c.name)) = lower(f_unaccent(:name))', { name: name.trim() })
      .getOne();
    return row ? ExpenseMapper.categoryToDomain(row) : null;
  }

  async list(): Promise<ExpenseCategory[]> {
    const rows = await (await this.db.repository(ExpenseCategoryOrmEntity)).find({ order: { name: 'ASC' } });
    return rows.map(ExpenseMapper.categoryToDomain);
  }

  async save(category: ExpenseCategory): Promise<void> {
    const saved = await (
      await this.db.repository(ExpenseCategoryOrmEntity)
    ).save(ExpenseMapper.categoryToPersistence(category));
    if (category.isNew) category.assignId(saved.id);
  }
}
