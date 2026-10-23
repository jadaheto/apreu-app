import { InstitutionProfile } from '../../domain/institution-profile.js';
import { InstitutionProfileMapper } from './institution-profile.mapper.js';
import { InstitutionOrmEntity } from './institution.orm-entity.js';

const row = (override: Partial<InstitutionOrmEntity> = {}) =>
  Object.assign(new InstitutionOrmEntity(), {
    id: 3,
    name: 'Colegio',
    nit: '900123456',
    address: null,
    phone: null,
    email: 'mal correo',
    logo: null,
    daneCode: '111001000123',
    resolutionNo: 'Res. 123',
    rectorName: null,
    city: 'Bogotá',
    department: null,
    ...override,
  });

describe('InstitutionProfileMapper', () => {
  it('returns null when the school has no data at all', () => {
    expect(InstitutionProfileMapper.toDomain(null, new Map())).toBeNull();
  });

  it('builds the profile from legacy settings when the institutions table is empty', () => {
    const profile = InstitutionProfileMapper.toDomain(
      null,
      new Map([
        ['school_name', 'Colegio Legacy'],
        ['school_nit', '900.123.456-7'],
        ['rector_name', 'Rector'],
        ['school_tax_responsibilities', 'O-13;O-15'],
        ['logo', 'public/uploads/logo_1.png'],
      ]),
    );
    expect(profile?.id).toBeNull();
    expect(profile?.snapshot()).toMatchObject({
      name: 'Colegio Legacy',
      documentType: 'NIT',
      personType: 'juridica',
      rectorName: 'Rector',
      taxResponsibilities: ['O-13', 'O-15'],
      logoPath: 'public/uploads/logo_1.png',
    });
    expect(profile?.nit.format()).toBe('900123456-8');
  });

  it('prefers the institutions row and tolerates malformed legacy values', () => {
    const profile = InstitutionProfileMapper.toDomain(
      row(),
      new Map([
        ['school_name', 'Otro'],
        ['school_doc_type', 'XX'],
      ]),
    );
    expect(profile?.snapshot()).toMatchObject({
      name: 'Colegio',
      email: null,
      city: 'Bogotá',
      documentType: 'NIT',
      daneCode: '111001000123',
    });
    expect(profile?.id).toBe(3);
  });

  it('writes the row plus the RUT settings and legacy mirrors', () => {
    const profile = InstitutionProfile.create({
      name: 'Colegio',
      nit: '800197268',
      documentType: 'NIT',
      personType: 'natural',
      taxResponsibilities: ['O-13'],
      rectorName: 'Rectora',
    });
    profile.changeLogo('institution/logo-1.png');
    expect(InstitutionProfileMapper.toRow(profile)).toMatchObject({
      name: 'Colegio',
      nit: '800197268',
      logo: 'institution/logo-1.png',
    });
    const settings = InstitutionProfileMapper.toSettings(profile);
    expect(Object.fromEntries(settings)).toMatchObject({
      school_name: 'Colegio',
      school_nit: '800197268',
      school_nit_dv: '4',
      school_person_type: 'natural',
      school_tax_responsibilities: 'O-13',
      rector_name: 'Rectora',
      logo: 'institution/logo-1.png',
      school_postal: null,
    });
  });
});
