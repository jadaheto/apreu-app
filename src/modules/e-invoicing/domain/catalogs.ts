/**
 * DIAN code lists (Anexo Técnico de Factura Electrónica v1.8/1.9) used by
 * this context. They are exposed read-only through `/e-invoicing/catalogs`.
 */
export interface CatalogEntry {
  code: string;
  name: string;
}

/** Electronic document kinds handled by the context (`dian_invoices.invoice_type`). */
export type DocumentType = 'fv' | 'nc' | 'nd';
export const DOCUMENT_TYPES: readonly DocumentType[] = ['fv', 'nc', 'nd'];

/** `1` producción, `2` habilitación (pruebas). */
export type DianEnvironment = '1' | '2';
export const DIAN_ENVIRONMENTS: readonly DianEnvironment[] = ['1', '2'];

/** Identification document types (lista 13.2.1). */
export const IDENTIFICATION_TYPES: readonly CatalogEntry[] = [
  { code: '11', name: 'Registro civil' },
  { code: '12', name: 'Tarjeta de identidad' },
  { code: '13', name: 'Cédula de ciudadanía' },
  { code: '21', name: 'Tarjeta de extranjería' },
  { code: '22', name: 'Cédula de extranjería' },
  { code: '31', name: 'NIT' },
  { code: '41', name: 'Pasaporte' },
  { code: '42', name: 'Documento de identificación extranjero' },
  { code: '47', name: 'PEP' },
  { code: '48', name: 'PPT (Permiso por protección temporal)' },
  { code: '50', name: 'NIT de otro país' },
  { code: '91', name: 'NUIP' },
];
export const NIT_ID_TYPE = '31';

/** Fiscal responsibilities (lista 13.2.6.1) relevant to schools. */
export const TAX_RESPONSIBILITIES: readonly CatalogEntry[] = [
  { code: 'O-13', name: 'Gran contribuyente' },
  { code: 'O-15', name: 'Autorretenedor' },
  { code: 'O-23', name: 'Agente de retención IVA' },
  { code: 'O-47', name: 'Régimen simple de tributación' },
  { code: 'R-99-PN', name: 'No aplica – Otros' },
];

/** VAT regime reported in `TaxLevelCode@listName`. */
export type VatRegime = '48' | '49';
export const VAT_REGIMES: readonly CatalogEntry[] = [
  { code: '48', name: 'Responsable del impuesto sobre las ventas – IVA' },
  { code: '49', name: 'No responsable de IVA' },
];

/** Payment form (`PaymentMeans/ID`): cash or credit. */
export type PaymentForm = '1' | '2';
export const PAYMENT_FORMS: readonly CatalogEntry[] = [
  { code: '1', name: 'Contado' },
  { code: '2', name: 'Crédito' },
];

/** Payment means (`PaymentMeansCode`, lista 13.3.4.2). */
export const PAYMENT_MEANS: readonly CatalogEntry[] = [
  { code: '1', name: 'Instrumento no definido' },
  { code: '10', name: 'Efectivo' },
  { code: '20', name: 'Cheque' },
  { code: '42', name: 'Consignación bancaria' },
  { code: '47', name: 'Transferencia débito bancaria' },
  { code: '48', name: 'Tarjeta crédito' },
  { code: '49', name: 'Tarjeta débito' },
  { code: 'ZZZ', name: 'Acuerdo mutuo' },
];

/** Credit note concepts (`DiscrepancyResponse/ResponseCode`, lista 13.2.4). */
export const CREDIT_NOTE_CONCEPTS: readonly CatalogEntry[] = [
  { code: '1', name: 'Devolución parcial de los bienes y/o no aceptación parcial del servicio' },
  { code: '2', name: 'Anulación de factura electrónica' },
  { code: '3', name: 'Rebaja o descuento parcial o total' },
  { code: '4', name: 'Ajuste de precio' },
  { code: '5', name: 'Otros' },
];

/** Debit note concepts (lista 13.2.5). */
export const DEBIT_NOTE_CONCEPTS: readonly CatalogEntry[] = [
  { code: '1', name: 'Intereses' },
  { code: '2', name: 'Gastos por cobrar' },
  { code: '3', name: 'Cambio del valor' },
  { code: '4', name: 'Otros' },
];

/** Tax treatment of an invoice line. Educational services are excluded from VAT (art. 476 E.T.). */
export type TaxTreatment = 'excluded' | 'exempt' | 'taxed';
export const TAX_TREATMENTS: readonly TaxTreatment[] = ['excluded', 'exempt', 'taxed'];

export const catalogName = (catalog: readonly CatalogEntry[], code: string): string | undefined =>
  catalog.find((entry) => entry.code === code)?.name;

export const isCatalogCode = (catalog: readonly CatalogEntry[], code: string): boolean =>
  catalog.some((entry) => entry.code === code);
