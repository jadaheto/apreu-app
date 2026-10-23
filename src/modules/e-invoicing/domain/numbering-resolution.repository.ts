import type { DocumentType } from './catalogs.js';
import type { NumberingResolution } from './numbering-resolution.js';

/** Output port for {@link NumberingResolution} (`dian_consecutives`). */
export interface NumberingResolutionRepository {
  findById(id: number): Promise<NumberingResolution | null>;
  list(): Promise<NumberingResolution[]>;
  findActive(docType: DocumentType): Promise<NumberingResolution | null>;
  /**
   * Active resolution of the type with its row locked (`SELECT … FOR UPDATE`).
   * Must be called inside `UNIT_OF_WORK.runInTransaction` so concurrent
   * issuances serialize on the consecutive (fixes the legacy race condition).
   */
  lockActive(docType: DocumentType): Promise<NumberingResolution | null>;
  findByPrefix(prefix: string): Promise<NumberingResolution[]>;
  save(resolution: NumberingResolution): Promise<void>;
}

export const NUMBERING_RESOLUTION_REPOSITORY = Symbol('NumberingResolutionRepository');
