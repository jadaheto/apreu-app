import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  type CatalogEntry,
  CREDIT_NOTE_CONCEPTS,
  DEBIT_NOTE_CONCEPTS,
  IDENTIFICATION_TYPES,
  PAYMENT_FORMS,
  PAYMENT_MEANS,
  TAX_RESPONSIBILITIES,
  VAT_REGIMES,
} from '../domain/catalogs.js';
import { DANE_DEPARTMENTS, DANE_MUNICIPALITIES } from '../domain/dane-catalog.js';

export const CATALOG_NAMES = [
  'id-types',
  'tax-responsibilities',
  'vat-regimes',
  'payment-forms',
  'payment-means',
  'credit-note-concepts',
  'debit-note-concepts',
  'dane-departments',
] as const;
export type CatalogName = (typeof CATALOG_NAMES)[number];

const STATIC_CATALOGS: Record<Exclude<CatalogName, 'dane-departments'>, readonly CatalogEntry[]> = {
  'id-types': IDENTIFICATION_TYPES,
  'tax-responsibilities': TAX_RESPONSIBILITIES,
  'vat-regimes': VAT_REGIMES,
  'payment-forms': PAYMENT_FORMS,
  'payment-means': PAYMENT_MEANS,
  'credit-note-concepts': CREDIT_NOTE_CONCEPTS,
  'debit-note-concepts': DEBIT_NOTE_CONCEPTS,
};

const toEntries = (record: Readonly<Record<string, string>>): CatalogEntry[] =>
  Object.entries(record).map(([code, name]) => ({ code, name }));

/** DIAN and DANE code lists (legacy `api/dian/dane_codes.php` plus UI constants). */
@Injectable()
export class GetCatalogUseCase implements UseCase<
  { name: CatalogName | 'dane-cities'; departmentCode?: string },
  CatalogEntry[]
> {
  async execute({
    name,
    departmentCode,
  }: {
    name: CatalogName | 'dane-cities';
    departmentCode?: string;
  }): Promise<CatalogEntry[]> {
    if (name === 'dane-departments') return toEntries(DANE_DEPARTMENTS);
    if (name === 'dane-cities') {
      if (!departmentCode || !DANE_DEPARTMENTS[departmentCode])
        throw new NotFoundError('Departamento', departmentCode ?? '');
      return toEntries(DANE_MUNICIPALITIES).filter((entry) => entry.code.startsWith(departmentCode));
    }
    const catalog = STATIC_CATALOGS[name];
    if (!catalog) throw new NotFoundError('Catálogo', name);
    return [...catalog];
  }
}
