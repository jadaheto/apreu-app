import type { InstitutionPersonType, InstitutionProfile } from '../domain/institution-profile.js';
import type { InstitutionDocumentType } from '../domain/nit.js';

/** Public URL of the logo endpoint. */
export const LOGO_URL = '/api/institution/logo';

/** Institution data returned to clients. */
export interface InstitutionProfileView {
  id: number | null;
  name: string;
  nit: string;
  nitDv: number | null;
  /** `900123456-8` */
  nitFormatted: string;
  documentType: InstitutionDocumentType;
  personType: InstitutionPersonType;
  address: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  cityDaneCode: string | null;
  department: string | null;
  departmentDaneCode: string | null;
  postalCode: string | null;
  taxResponsibilities: string[];
  daneCode: string | null;
  resolutionNumber: string | null;
  rectorName: string | null;
  billingContact: { name: string | null; phone: string | null; email: string | null };
  logoUrl: string | null;
}

export const toInstitutionProfileView = (profile: InstitutionProfile): InstitutionProfileView => {
  const p = profile.snapshot();
  return {
    id: profile.id,
    name: p.name,
    nit: p.nit.number,
    nitDv: p.nit.dv,
    nitFormatted: p.nit.format(),
    documentType: p.documentType,
    personType: p.personType,
    address: p.address,
    phone: p.phone,
    email: p.email?.toString() ?? null,
    city: p.city,
    cityDaneCode: p.cityDaneCode,
    department: p.department,
    departmentDaneCode: p.departmentDaneCode,
    postalCode: p.postalCode,
    taxResponsibilities: p.taxResponsibilities,
    daneCode: p.daneCode,
    resolutionNumber: p.resolutionNumber,
    rectorName: p.rectorName,
    billingContact: {
      name: p.billingContactName,
      phone: p.billingContactPhone,
      email: p.billingContactEmail?.toString() ?? null,
    },
    logoUrl: p.logoPath ? LOGO_URL : null,
  };
};
