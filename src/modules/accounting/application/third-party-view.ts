import type { DocumentType } from '../domain/identity-document.js';
import type { ThirdParty } from '../domain/third-party.js';

/** Read model of an accounting third party. */
export interface ThirdPartyView {
  id: number;
  documentType: DocumentType;
  documentNumber: string;
  dv: string | null;
  /** e.g. `900123456-7`. */
  document: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  isActive: boolean;
}

export const toThirdPartyView = (party: ThirdParty): ThirdPartyView => ({
  id: party.id as number,
  documentType: party.document.type,
  documentNumber: party.document.number,
  dv: party.document.dv,
  document: party.document.toString(),
  name: party.name,
  email: party.email?.toString() ?? null,
  phone: party.phone,
  address: party.address,
  city: party.city,
  isActive: party.isActive,
});
