import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { DANE_DEPARTMENTS, DANE_MUNICIPALITIES } from '../../domain/dane-catalog.js';
import { DocumentLine, type DocumentLineInput } from '../../domain/document-line.js';
import type { IssuerConfig } from '../../domain/issuer-config.js';
import { type DaneLocation, Party } from '../../domain/party.js';
import type { VatRegime } from '../../domain/catalogs.js';

/** Acquirer data received by the use cases. Location defaults to the school's municipality. */
export interface CustomerInput {
  name: string;
  idType: string;
  idNumber: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  cityCode?: string | null;
  taxLevelCode?: string | null;
  vatRegime?: VatRegime | null;
  firstName?: string | null;
  familyName?: string | null;
}

/**
 * Builds the {@link Party} of a customer. Unlike the legacy manual invoice
 * (which always reported Bogotá), a missing municipality falls back to the
 * issuer's municipality, and DANE names are taken from the catalog.
 */
export function toCustomerParty(input: CustomerInput, issuer: IssuerConfig): Party {
  return Party.create({
    name: input.name,
    idType: input.idType,
    idNumber: input.idNumber,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    location: input.cityCode ? daneLocation(input.cityCode) : issuer.location,
    taxLevelCode: input.taxLevelCode ?? 'R-99-PN',
    vatRegime: input.vatRegime ?? '49',
    firstName: input.firstName ?? null,
    familyName: input.familyName ?? null,
  });
}

/** Resolves a municipality code against the DANE catalog. */
export function daneLocation(cityCode: string): DaneLocation {
  const cityName = DANE_MUNICIPALITIES[cityCode];
  const departmentCode = cityCode.slice(0, 2);
  const departmentName = DANE_DEPARTMENTS[departmentCode];
  if (!cityName || !departmentName) {
    throw new BusinessRuleViolationError(`Código DANE de municipio desconocido: ${cityCode}.`, 'INVALID_DANE_CODE');
  }
  return { cityCode, cityName, departmentCode, departmentName };
}

export const toLines = (lines: DocumentLineInput[]): DocumentLine[] => lines.map((line) => DocumentLine.create(line));
