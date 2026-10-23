import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { Certificate } from '../../domain/certificate.js';
import type { CertificateRepository } from '../../domain/certificate.repository.js';
import { CertificateOrmEntity } from './certificate.orm-entity.js';
import { CertificateMapper } from './mappers.js';

/** TypeORM adapter of {@link CertificateRepository}. */
@Injectable()
export class TypeOrmCertificateRepository implements CertificateRepository {
  constructor(private readonly db: TenantDataSource) {}

  private repository() {
    return this.db.repository(CertificateOrmEntity);
  }

  async findById(id: number): Promise<Certificate | null> {
    const row = await (await this.repository()).findOneBy({ id });
    return row ? CertificateMapper.toDomain(row) : null;
  }

  async findByVerificationCode(code: string): Promise<Certificate | null> {
    const row = await (await this.repository()).findOneBy({ verificationCode: code });
    return row ? CertificateMapper.toDomain(row) : null;
  }

  async listByStudent(studentId: number): Promise<Certificate[]> {
    const rows = await (
      await this.repository()
    ).find({ where: { studentId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return rows.map(CertificateMapper.toDomain);
  }

  async existsForPayment(paymentId: number): Promise<boolean> {
    return (await this.repository()).exists({ where: { paymentId } });
  }

  async save(certificate: Certificate): Promise<void> {
    const saved = await (await this.repository()).save(CertificateMapper.toPersistence(certificate));
    if (certificate.isNew) certificate.assignId(saved.id);
  }
}
