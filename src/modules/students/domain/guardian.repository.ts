import type { Guardian } from './guardian.js';

/** Output port for persisting {@link Guardian} aggregates. */
export interface GuardianRepository {
  findById(id: number): Promise<Guardian | null>;
  findByIds(ids: number[]): Promise<Guardian[]>;
  /** `guardians.document_number` is unique regardless of the document type. */
  findByDocumentNumber(documentNumber: string): Promise<Guardian | null>;
  findByUserId(userId: number): Promise<Guardian | null>;
  save(guardian: Guardian): Promise<void>;
}

export const GUARDIAN_REPOSITORY = Symbol('GuardianRepository');
