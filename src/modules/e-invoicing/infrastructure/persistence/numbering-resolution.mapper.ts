import { NumberingResolution } from '../../domain/numbering-resolution.js';
import { NumberingResolutionOrmEntity } from './numbering-resolution.orm-entity.js';
import type { SecretCipher } from './secret-cipher.js';

/** Translates `dian_consecutives` rows; the technical key is encrypted at rest. */
export class NumberingResolutionMapper {
  constructor(private readonly cipher: SecretCipher) {}

  toDomain(row: NumberingResolutionOrmEntity): NumberingResolution {
    return NumberingResolution.restore(row.id, {
      docType: row.docType,
      prefix: row.prefix,
      rangeFrom: Number(row.rangeFrom),
      rangeTo: Number(row.rangeTo),
      current: Number(row.currentConsecutive),
      resolutionNumber: row.resolutionNumber,
      validFrom: row.validFrom,
      validTo: row.validTo,
      technicalKey: row.technicalKey ? this.cipher.decrypt(row.technicalKey) : null,
      environment: row.environment,
      cycle: Number(row.numberingCycle),
      active: row.isActive,
    });
  }

  toPersistence(resolution: NumberingResolution): NumberingResolutionOrmEntity {
    const row = new NumberingResolutionOrmEntity();
    if (resolution.id !== null) row.id = resolution.id;
    row.docType = resolution.docType;
    row.prefix = resolution.prefix;
    row.rangeFrom = resolution.rangeFrom;
    row.rangeTo = resolution.rangeTo;
    row.currentConsecutive = Math.max(resolution.current, 0);
    row.resolutionNumber = resolution.resolutionNumber;
    row.validFrom = resolution.validFrom;
    row.validTo = resolution.validTo;
    row.technicalKey = resolution.technicalKey ? this.cipher.encrypt(resolution.technicalKey) : null;
    row.environment = resolution.environment;
    row.numberingCycle = resolution.cycle;
    row.isActive = resolution.isActive;
    return row;
  }
}
