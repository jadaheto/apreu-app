import { ConflictError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import {
  GUARDIAN_DOCUMENT_TYPES,
  type GuardianDocumentType,
  optionalEmail,
  optionalText,
  RELATIONSHIPS,
  type Relationship,
  requiredText,
} from './catalogs.js';

/** Data of a legal guardian captured in the enrollment form (tab 2). */
export interface GuardianDetails {
  documentType?: GuardianDocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  relationship?: Relationship;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  occupation?: string | null;
}

export interface GuardianProps {
  documentType: GuardianDocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  relationship: Relationship;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  occupation: string | null;
  /** Portal account (`guardians.user_id`, added by migration `students-001`). */
  userId: number | null;
  createdAt: Date | null;
}

/**
 * Legal guardian (`guardians` table). The document number is unique per
 * school, so a guardian is shared between siblings: enrollment reuses the
 * existing record instead of inserting a duplicate (fixes bug B10).
 */
export class Guardian extends Entity<GuardianProps> {
  private constructor(id: EntityId, props: GuardianProps) {
    super(id, props);
  }

  static create(details: GuardianDetails): Guardian {
    return new Guardian(null, {
      ...Guardian.validate(details),
      userId: null,
      createdAt: null,
    });
  }

  static restore(id: number, props: GuardianProps): Guardian {
    return new Guardian(id, { ...props });
  }

  get documentType(): GuardianDocumentType {
    return this.props.documentType;
  }
  get documentNumber(): string {
    return this.props.documentNumber;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }
  get relationship(): Relationship {
    return this.props.relationship;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get mobile(): string | null {
    return this.props.mobile;
  }
  get email(): string | null {
    return this.props.email;
  }
  get address(): string | null {
    return this.props.address;
  }
  get city(): string | null {
    return this.props.city;
  }
  get occupation(): string | null {
    return this.props.occupation;
  }
  get userId(): number | null {
    return this.props.userId;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Replaces the guardian data. Affects every sibling linked to this guardian. */
  update(details: GuardianDetails): void {
    Object.assign(this.props, Guardian.validate(details));
  }

  /** Links the `parent` portal account. */
  linkUser(userId: number): void {
    if (this.props.userId !== null && this.props.userId !== userId) {
      throw new ConflictError('El acudiente ya tiene una cuenta de usuario vinculada.', { userId: this.props.userId });
    }
    this.props.userId = userId;
  }

  private static validate(details: GuardianDetails) {
    const documentType = details.documentType ?? 'cc';
    const relationship = details.relationship ?? 'padre';
    Guard.oneOf(documentType, GUARDIAN_DOCUMENT_TYPES, 'tipo de documento del acudiente');
    Guard.oneOf(relationship, RELATIONSHIPS, 'parentesco');
    return {
      documentType,
      documentNumber: requiredText(details.documentNumber, 30, 'documento del acudiente'),
      firstName: requiredText(details.firstName, 100, 'nombres del acudiente'),
      lastName: requiredText(details.lastName, 100, 'apellidos del acudiente'),
      relationship,
      phone: optionalText(details.phone, 20, 'teléfono del acudiente'),
      mobile: optionalText(details.mobile, 20, 'celular del acudiente'),
      email: optionalEmail(details.email),
      address: optionalText(details.address, 65_535, 'dirección del acudiente'),
      city: optionalText(details.city, 100, 'ciudad del acudiente'),
      occupation: optionalText(details.occupation, 100, 'ocupación del acudiente'),
    };
  }
}
