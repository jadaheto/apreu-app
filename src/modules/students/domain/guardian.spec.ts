import { ConflictError } from '../../../shared/domain/domain-error.js';
import { Guardian, type GuardianDetails } from './guardian.js';

const details: GuardianDetails = {
  documentNumber: ' 52123456 ',
  firstName: 'Marta',
  lastName: 'Ruiz',
  email: 'MARTA@c.co',
};

describe('Guardian', () => {
  it('creates a guardian with defaults and normalized data', () => {
    const guardian = Guardian.create(details);
    expect(guardian).toMatchObject({
      documentType: 'cc',
      documentNumber: '52123456',
      fullName: 'Marta Ruiz',
      relationship: 'padre',
      email: 'marta@c.co',
      userId: null,
      mobile: null,
    });
  });

  it.each([
    [{ documentNumber: '' }, 'REQUIRED_FIELD'],
    [{ lastName: ' ' }, 'REQUIRED_FIELD'],
    [{ documentType: 'ext' as never }, 'INVALID_OPTION'],
    [{ relationship: 'hermano' as never }, 'INVALID_OPTION'],
    [{ email: 'malo' }, 'INVALID_EMAIL'],
  ])('rejects %o (legacy enum mismatch B9)', (override, code) => {
    expect(() => Guardian.create({ ...details, ...override })).toThrow(expect.objectContaining({ code }));
  });

  it('updates its data and links one user', () => {
    const guardian = Guardian.create(details);
    guardian.update({ ...details, mobile: '300', relationship: 'abuela' });
    expect(guardian).toMatchObject({ mobile: '300', relationship: 'abuela' });
    guardian.linkUser(9);
    expect(guardian.userId).toBe(9);
    expect(() => guardian.linkUser(10)).toThrow(ConflictError);
  });
});
