import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { Account } from '../../domain/account.js';
import type { AccountRepository } from '../../domain/account.repository.js';
import { AccountOrmEntity } from './account.orm-entity.js';
import { AccountMapper } from './accounting.mappers.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Account | null> {
    const row = await (await this.db.repository(AccountOrmEntity)).findOneBy({ id });
    return row ? AccountMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<Account[]> {
    if (ids.length === 0) return [];
    const rows = await (await this.db.repository(AccountOrmEntity)).findBy({ id: In(ids) });
    return rows.map(AccountMapper.toDomain);
  }

  async findByCode(code: string): Promise<Account | null> {
    const row = await (await this.db.repository(AccountOrmEntity)).findOneBy({ code });
    return row ? AccountMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Account[]> {
    const rows = await (await this.db.repository(AccountOrmEntity)).find({ order: { code: 'ASC' } });
    return rows.map(AccountMapper.toDomain);
  }

  async hasMovements(id: number): Promise<boolean> {
    return (await this.db.repository(JournalLineOrmEntity)).exists({ where: { accountId: id } });
  }

  async hasChildren(id: number): Promise<boolean> {
    return (await this.db.repository(AccountOrmEntity)).exists({ where: { parentId: id } });
  }

  async save(account: Account): Promise<void> {
    const saved = await (await this.db.repository(AccountOrmEntity)).save(AccountMapper.toPersistence(account));
    if (account.isNew) account.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(AccountOrmEntity)).delete({ id });
  }
}
