import type { DianEnvironment, DocumentType } from '../domain/catalogs.js';
import type { NumberingResolution } from '../domain/numbering-resolution.js';

/** Numbering resolution as returned by the API (the technical key is never exposed). */
export interface ResolutionView {
  id: number;
  docType: DocumentType;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  current: number;
  remaining: number;
  resolutionNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  environment: DianEnvironment;
  technicalKeyConfigured: boolean;
  cycle: number;
  active: boolean;
}

export const toResolutionView = (resolution: NumberingResolution): ResolutionView => ({
  id: resolution.id as number,
  docType: resolution.docType,
  prefix: resolution.prefix,
  rangeFrom: resolution.rangeFrom,
  rangeTo: resolution.rangeTo,
  current: resolution.current,
  remaining: resolution.remaining,
  resolutionNumber: resolution.resolutionNumber,
  validFrom: resolution.validFrom,
  validTo: resolution.validTo,
  environment: resolution.environment,
  technicalKeyConfigured: Boolean(resolution.technicalKey),
  cycle: resolution.cycle,
  active: resolution.isActive,
});
