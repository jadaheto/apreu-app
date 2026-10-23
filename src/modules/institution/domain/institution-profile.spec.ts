import { InstitutionProfile, type InstitutionProfileData } from './institution-profile.js';

const data: InstitutionProfileData = {
  name: '  Colegio San José ',
  nit: '900123456',
  documentType: 'NIT',
  personType: 'juridica',
  address: 'Calle 1 # 2-3',
  phone: '+57 601 5555555',
  email: 'INFO@colegio.edu.co',
  cityDaneCode: '11001',
  departmentDaneCode: '11',
  postalCode: '110111',
  taxResponsibilities: ['o-13', 'O-13', ' R-99-PN '],
  daneCode: '111001000123',
  billingContactEmail: 'facturas@colegio.edu.co',
  rectorName: 'Rectora',
  city: '',
};

describe('InstitutionProfile', () => {
  it('normalizes data and derives the NIT check digit', () => {
    const profile = InstitutionProfile.create(data);
    const snapshot = profile.snapshot();
    expect(profile.name).toBe('Colegio San José');
    expect(profile.nit.format()).toBe('900123456-8');
    expect(snapshot.email?.toString()).toBe('info@colegio.edu.co');
    expect(snapshot.taxResponsibilities).toEqual(['O-13', 'R-99-PN']);
    expect(snapshot.city).toBeNull();
    expect(profile.logoPath).toBeNull();
  });

  it.each([
    [{ name: ' ' }, 'REQUIRED_FIELD'],
    [{ nit: '12' }, 'INVALID_NIT'],
    [{ documentType: 'TI' as never }, 'INVALID_OPTION'],
    [{ personType: 'otra' as never }, 'INVALID_OPTION'],
    [{ phone: 'llamar' }, 'INVALID_FORMAT'],
    [{ postalCode: '1101' }, 'INVALID_FORMAT'],
    [{ departmentDaneCode: '111' }, 'MAX_LENGTH'],
    [{ cityDaneCode: '1100' }, 'INVALID_FORMAT'],
    [{ taxResponsibilities: ['O 13'] }, 'INVALID_FORMAT'],
    [{ email: 'no-es-correo' }, 'INVALID_EMAIL'],
  ])('rejects %o', (override, code) => {
    expect(() => InstitutionProfile.create({ ...data, ...override })).toThrow(expect.objectContaining({ code }));
  });

  it('replaces the data keeping the logo', () => {
    const profile = InstitutionProfile.create(data);
    profile.changeLogo('institution/logo-1.png');
    profile.update({ ...data, name: 'Nuevo nombre', nit: '800197268' });
    expect(profile).toMatchObject({ name: 'Nuevo nombre', logoPath: 'institution/logo-1.png' });
    expect(profile.nit.dv).toBe(4);
    expect(() => profile.changeLogo('')).toThrow();
  });
});
