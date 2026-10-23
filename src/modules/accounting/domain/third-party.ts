import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Email } from '../../../shared/domain/value-objects/email.vo.js';
import { IdentityDocument, type DocumentType } from './identity-document.js';

export interface ThirdPartyContact {
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

export interface ThirdPartyProps {
  document: IdentityDocument;
  name: string;
  email: Email | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: Date | null;
}

export interface ThirdPartyDetails extends Partial<ThirdPartyContact> {
  documentType: DocumentType;
  documentNumber: string;
  dv?: string | null;
  name: string;
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Accounting third party: customer, supplier or employee
 * (`accounting_third_parties`, legacy `accounting/third_parties.php`).
 * Independent from students/employees of other contexts.
 */
export class ThirdParty extends Entity<ThirdPartyProps> {
  private constructor(id: EntityId, props: ThirdPartyProps) {
    super(id, props);
  }

  static create(details: ThirdPartyDetails): ThirdParty {
    const party = new ThirdParty(null, {
      document: IdentityDocument.create(details.documentType, details.documentNumber, details.dv),
      name: '',
      email: null,
      phone: null,
      address: null,
      city: null,
      isActive: true,
      createdAt: null,
    });
    party.update(details);
    return party;
  }

  static restore(id: number, props: ThirdPartyProps): ThirdParty {
    return new ThirdParty(id, { ...props });
  }

  get document(): IdentityDocument {
    return this.props.document;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): Email | null {
    return this.props.email;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get address(): string | null {
    return this.props.address;
  }
  get city(): string | null {
    return this.props.city;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Replaces the document, name and contact data (missing contact fields become empty). */
  update(details: ThirdPartyDetails): void {
    const name = details.name?.trim();
    Guard.againstEmpty(name, 'nombre o razón social');
    Guard.againstMaxLength(name, 200, 'nombre o razón social');
    const phone = blankToNull(details.phone);
    const city = blankToNull(details.city);
    Guard.againstMaxLength(phone, 50, 'teléfono');
    Guard.againstMaxLength(city, 100, 'ciudad');
    const email = blankToNull(details.email);
    this.props.document = IdentityDocument.create(details.documentType, details.documentNumber, details.dv);
    this.props.name = name;
    this.props.email = email ? Email.create(email) : null;
    this.props.phone = phone;
    this.props.address = blankToNull(details.address);
    this.props.city = city;
  }

  deactivate(): void {
    this.props.isActive = false;
  }

  activate(): void {
    this.props.isActive = true;
  }
}
