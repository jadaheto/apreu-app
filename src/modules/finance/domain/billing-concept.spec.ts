import { BillingConcept } from './billing-concept.js';

describe('BillingConcept', () => {
  it('creates an active concept with normalized fields', () => {
    const concept = BillingConcept.create({
      name: '  Certificado ',
      code: 'cert01',
      category: 'certificado',
      amount: 25000,
    });
    expect(concept).toMatchObject({ name: 'Certificado', code: 'CERT01', isActive: true, description: null });
    expect(concept.isCertificate).toBe(true);
    expect(concept.taxRate.percent).toBe(0);
  });

  it.each([
    [{ name: '', amount: 1 }, 'REQUIRED_FIELD'],
    [{ name: 'X', amount: -1 }, 'NEGATIVE_VALUE'],
    [{ name: 'X', amount: 1, taxRate: 150 }, 'OUT_OF_RANGE'],
    [{ name: 'X', amount: 1, category: 'beca' as never }, 'INVALID_OPTION'],
    [{ name: 'X'.repeat(201), amount: 1 }, 'MAX_LENGTH'],
  ])('rejects %o', (data, code) => {
    expect(() => BillingConcept.create(data)).toThrow(expect.objectContaining({ code }));
  });

  it('updates and toggles without deleting', () => {
    const concept = BillingConcept.create({ name: 'Pensión', amount: 350000 });
    concept.update({ name: 'Mensualidad', amount: 380000, taxRate: 5, category: 'mensualidad' });
    concept.deactivate();
    expect(concept).toMatchObject({ name: 'Mensualidad', category: 'mensualidad', isActive: false });
    expect(concept.amount.amount).toBe(380000);
    concept.activate();
    expect(concept.isActive).toBe(true);
  });
});
