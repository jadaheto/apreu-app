import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { ThirdParty } from './third-party.js';

export interface ThirdPartySearchCriteria {
  /** Matches name or document number. */
  search?: string;
  isActive?: boolean;
}

/** Output port for persisting {@link ThirdParty} aggregates. */
export interface ThirdPartyRepository {
  findById(id: number): Promise<ThirdParty | null>;
  findByIds(ids: number[]): Promise<ThirdParty[]>;
  findByDocumentNumber(documentNumber: string): Promise<ThirdParty | null>;
  search(criteria: ThirdPartySearchCriteria, page: PageRequest): Promise<Paginated<ThirdParty>>;
  hasMovements(id: number): Promise<boolean>;
  save(thirdParty: ThirdParty): Promise<void>;
  delete(id: number): Promise<void>;
}

export const THIRD_PARTY_REPOSITORY = Symbol('ThirdPartyRepository');
