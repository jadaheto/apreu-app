/** Payment channels accepted by the cashier (`payments.payment_method` ENUM). */
export const PAYMENT_METHODS = [
  'efectivo',
  'transferencia',
  'nequi',
  'daviplata',
  'breb',
  'transferencia_ext',
  'tarjeta',
  'pse',
  'cheque',
  'datafono',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Human readable labels (legacy `finance/cashier.php`). */
export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  breb: 'Bre-B',
  transferencia_ext: 'Transferencia otros bancos',
  tarjeta: 'Tarjeta débito/crédito',
  pse: 'PSE',
  cheque: 'Cheque',
  datafono: 'Datáfono',
};

export const isPaymentMethod = (value: string): value is PaymentMethod =>
  (PAYMENT_METHODS as readonly string[]).includes(value);
