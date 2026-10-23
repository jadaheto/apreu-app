import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Amounts } from './amounts.js';
import { TAX_TREATMENTS, type TaxTreatment } from './catalogs.js';

export interface DocumentLineInput {
  description: string;
  /** Internal item code (billing concept), emitted as `StandardItemIdentification`. */
  code?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  /** Defaults to `excluded`: school services are excluded from VAT (art. 476 E.T.). */
  taxTreatment?: TaxTreatment;
  /** Percentage, only for `taxed` lines (e.g. 19). */
  taxRate?: number | string;
}

export interface DocumentLineProps {
  description: string;
  code: string;
  quantityHundredths: number;
  unitPriceCents: number;
  taxTreatment: TaxTreatment;
  taxRateBasisPoints: number;
}

/**
 * One line of an electronic document.
 *
 * `lineTotal = quantity × unitPrice` and `tax = round(lineTotal × rate)` with
 * half-up rounding to cents (legacy `generate_invoice.php:114-143`).
 * Unlike the legacy (default 19 %), a line is **excluded** from VAT unless
 * stated otherwise; `exempt` lines report VAT at 0 %.
 */
export class DocumentLine {
  private constructor(private readonly props: DocumentLineProps) {
    Object.freeze(this);
  }

  static create(input: DocumentLineInput): DocumentLine {
    const description = input.description?.trim();
    Guard.againstEmpty(description, 'descripción de la línea');
    Guard.againstMaxLength(description, 300, 'descripción de la línea');
    const quantityHundredths = Amounts.toScaled(input.quantity, 2, 'cantidad');
    const unitPriceCents = Amounts.toScaled(input.unitPrice, 2, 'precio unitario');
    if (quantityHundredths <= 0) {
      throw new BusinessRuleViolationError('La cantidad debe ser mayor que cero.', 'INVALID_QUANTITY');
    }
    if (unitPriceCents <= 0) {
      throw new BusinessRuleViolationError('El precio unitario debe ser mayor que cero.', 'INVALID_UNIT_PRICE');
    }
    const taxTreatment = input.taxTreatment ?? 'excluded';
    Guard.oneOf(taxTreatment, TAX_TREATMENTS, 'tratamiento tributario');
    const taxRateBasisPoints = taxTreatment === 'taxed' ? Amounts.toScaled(input.taxRate ?? '', 2, 'tarifa de IVA') : 0;
    if (taxTreatment === 'taxed' && (taxRateBasisPoints <= 0 || taxRateBasisPoints > 10_000)) {
      throw new BusinessRuleViolationError(
        'Una línea gravada requiere una tarifa de IVA entre 0 y 100 %.',
        'INVALID_TAX_RATE',
      );
    }
    return new DocumentLine({
      description,
      code: input.code?.trim() || '',
      quantityHundredths,
      unitPriceCents,
      taxTreatment,
      taxRateBasisPoints,
    });
  }

  static restore(props: DocumentLineProps): DocumentLine {
    return new DocumentLine({ ...props });
  }

  get description(): string {
    return this.props.description;
  }
  get code(): string {
    return this.props.code;
  }
  get quantityHundredths(): number {
    return this.props.quantityHundredths;
  }
  get unitPriceCents(): number {
    return this.props.unitPriceCents;
  }
  get taxTreatment(): TaxTreatment {
    return this.props.taxTreatment;
  }
  get taxRateBasisPoints(): number {
    return this.props.taxRateBasisPoints;
  }
  /** True when the line reports VAT (taxed or exempt at 0 %); excluded lines do not. */
  get reportsTax(): boolean {
    return this.props.taxTreatment !== 'excluded';
  }
  get lineTotalCents(): number {
    return Amounts.lineTotal(this.props.quantityHundredths, this.props.unitPriceCents);
  }
  get taxCents(): number {
    return Amounts.tax(this.lineTotalCents, this.props.taxRateBasisPoints);
  }

  toProps(): DocumentLineProps {
    return { ...this.props };
  }
}

/** VAT group of the header `TaxTotal` (one per rate, in order of first appearance). */
export interface TaxSubtotal {
  rateBasisPoints: number;
  taxableCents: number;
  taxCents: number;
}

/** Monetary totals of a document (`LegalMonetaryTotal` / `RequestedMonetaryTotal`). */
export interface DocumentTotals {
  /** Σ line totals (`LineExtensionAmount`, CUFE `ValFac`). */
  lineExtensionCents: number;
  /** Σ taxable bases of the reported taxes (`TaxExclusiveAmount`, rule FAU04). */
  taxExclusiveCents: number;
  /** Σ VAT (CUFE `ValImp1`). */
  taxCents: number;
  /** `TaxInclusiveAmount` = `PayableAmount` (CUFE `ValTot`). */
  payableCents: number;
  taxSubtotals: TaxSubtotal[];
}

/** Computes header totals and VAT groups from the lines. */
export function computeTotals(lines: readonly DocumentLine[]): DocumentTotals {
  const groups = new Map<number, TaxSubtotal>();
  for (const line of lines.filter((l) => l.reportsTax)) {
    const group = groups.get(line.taxRateBasisPoints) ?? {
      rateBasisPoints: line.taxRateBasisPoints,
      taxableCents: 0,
      taxCents: 0,
    };
    group.taxableCents += line.lineTotalCents;
    group.taxCents += line.taxCents;
    groups.set(line.taxRateBasisPoints, group);
  }
  const taxSubtotals = [...groups.values()];
  const lineExtensionCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const taxCents = taxSubtotals.reduce((sum, group) => sum + group.taxCents, 0);
  return {
    lineExtensionCents,
    taxExclusiveCents: taxSubtotals.reduce((sum, group) => sum + group.taxableCents, 0),
    taxCents,
    payableCents: lineExtensionCents + taxCents,
    taxSubtotals,
  };
}
