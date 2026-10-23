/** Voucher (comprobante) types of `accounting_journal_entries.entry_type`. */
export const VOUCHER_TYPES = ['RC', 'CE', 'FC', 'FV', 'NC', 'ND', 'NI', 'SALA'] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  RC: 'Recibo de Caja',
  CE: 'Comprobante de Egreso',
  FC: 'Factura de Compra',
  FV: 'Factura de Venta',
  NC: 'Nota Crédito',
  ND: 'Nota Débito',
  NI: 'Nota Interna',
  SALA: 'Nómina',
};

/** Consecutives are padded to 6 digits (RN-JE-05), e.g. `000042`. */
export const formatVoucherNumber = (sequence: number): string => String(sequence).padStart(6, '0');
