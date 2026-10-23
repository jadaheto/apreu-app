import { Injectable, Logger } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { AccessLogEntry, AccessLogPort } from '../../application/ports/access-log.port.js';
import { AccessLogOrmEntity } from './access-log.orm-entity.js';

/** Audit writer. Failures are logged and swallowed: auditing must never block a login. */
@Injectable()
export class TypeOrmAccessLog implements AccessLogPort {
  private readonly logger = new Logger(TypeOrmAccessLog.name);

  constructor(private readonly db: TenantDataSource) {}

  async record(entry: AccessLogEntry): Promise<void> {
    try {
      await (
        await this.db.repository(AccessLogOrmEntity)
      ).insert({
        userId: entry.userId,
        role: entry.role.slice(0, 30),
        path: entry.path.slice(0, 255),
        module: entry.module.slice(0, 50),
        allowed: entry.allowed,
        ipAddress: entry.ipAddress.slice(0, 45),
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar el acceso: ${(error as Error).message}`);
    }
  }
}
