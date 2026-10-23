import { computeTotals, DocumentLine } from './document-line.js';

describe('DocumentLine', () => {
  it('is excluded from VAT by default (educational services)', () => {
    const line = DocumentLine.create({ description: ' Pensión ', quantity: 2, unitPrice: 350000 });
    expect(line).toMatchObject({
      description: 'Pensión',
      taxTreatment: 'excluded',
      reportsTax: false,
      lineTotalCents: 70_000_000,
      taxCents: 0,
    });
  });

  it('computes VAT for taxed lines', () => {
    const line = DocumentLine.create({
      description: 'Uniforme',
      quantity: 1,
      unitPrice: 100000,
      taxTreatment: 'taxed',
      taxRate: 19,
    });
    expect(line.taxCents).toBe(1_900_000);
    expect(line.reportsTax).toBe(true);
  });

  it.each([
    [{ quantity: 0 }, 'INVALID_QUANTITY'],
    [{ unitPrice: -1 }, 'INVALID_UNIT_PRICE'],
    [{ description: '' }, 'REQUIRED_FIELD'],
    [{ taxTreatment: 'taxed' as const, taxRate: 0 }, 'INVALID_TAX_RATE'],
    [{ taxTreatment: 'otro' as never }, 'INVALID_OPTION'],
  ])('rejects %o', (override, code) => {
    expect(() => DocumentLine.create({ description: 'x', quantity: 1, unitPrice: 10, ...override })).toThrow(
      expect.objectContaining({ code }),
    );
  });
});

describe('computeTotals', () => {
  it('groups reported taxes by rate and uses the taxable base as TaxExclusiveAmount', () => {
    const totals = computeTotals([
      DocumentLine.create({ description: 'Pensión', quantity: 1, unitPrice: 350000 }),
      DocumentLine.create({
        description: 'Uniforme',
        quantity: 2,
        unitPrice: 50000,
        taxTreatment: 'taxed',
        taxRate: 19,
      }),
      DocumentLine.create({ description: 'Libro', quantity: 1, unitPrice: 20000, taxTreatment: 'exempt' }),
    ]);
    expect(totals).toEqual({
      lineExtensionCents: 47_000_000,
      taxExclusiveCents: 12_000_000,
      taxCents: 1_900_000,
      payableCents: 48_900_000,
      taxSubtotals: [
        { rateBasisPoints: 1900, taxableCents: 10_000_000, taxCents: 1_900_000 },
        { rateBasisPoints: 0, taxableCents: 2_000_000, taxCents: 0 },
      ],
    });
  });

  it('has no tax groups when every line is excluded', () => {
    expect(
      computeTotals([DocumentLine.create({ description: 'Pensión', quantity: 1, unitPrice: 1000 })]).taxSubtotals,
    ).toEqual([]);
  });
});
