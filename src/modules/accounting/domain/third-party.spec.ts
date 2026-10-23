import { IdentityDocument, nitCheckDigit } from './identity-document.js';
import { ThirdParty } from './third-party.js';

describe('IdentityDocument', () => {
  it.each([
    ['890903938', '8'],
    ['860034313', '7'],
    ['800197268', '4'],
  ])('computes the DIAN check digit of NIT %s', (nit, dv) => {
    expect(nitCheckDigit(nit)).toBe(dv);
  });

  it('normalizes the NIT and fills the check digit', () => {
    const document = IdentityDocument.create('NIT', '890.903.938');
    expect(document.toString()).toBe('890903938-8');
  });

  it('rejects a wrong check digit', () => {
    expect(() => IdentityDocument.create('NIT', '890903938', '1')).toThrow(
      expect.objectContaining({ code: 'INVALID_NIT_CHECK_DIGIT' }),
    );
  });

  it('ignores the DV for other types and validates numeric documents', () => {
    expect(IdentityDocument.create('CC', '1.020.304', '5').dv).toBeNull();
    expect(IdentityDocument.create('Pasaporte', 'ab123').number).toBe('AB123');
    expect(() => IdentityDocument.create('CC', 'ABC')).toThrow(
      expect.objectContaining({ code: 'INVALID_DOCUMENT_NUMBER' }),
    );
  });
});

describe('ThirdParty', () => {
  const details = {
    documentType: 'CC' as const,
    documentNumber: '1020304',
    name: ' Ana Pérez ',
    email: 'ANA@MAIL.CO',
    city: ' ',
  };

  it('creates an active third party with normalized contact data', () => {
    const party = ThirdParty.create(details);
    expect(party).toMatchObject({ name: 'Ana Pérez', isActive: true, city: null, phone: null });
    expect(party.email?.toString()).toBe('ana@mail.co');
  });

  it('requires a name and a valid e-mail', () => {
    expect(() => ThirdParty.create({ ...details, name: '' })).toThrow(
      expect.objectContaining({ code: 'REQUIRED_FIELD' }),
    );
    expect(() => ThirdParty.create({ ...details, email: 'x' })).toThrow(
      expect.objectContaining({ code: 'INVALID_EMAIL' }),
    );
  });

  it('can be deactivated and reactivated', () => {
    const party = ThirdParty.create(details);
    party.deactivate();
    expect(party.isActive).toBe(false);
    party.activate();
    expect(party.isActive).toBe(true);
  });
});
