/** Generates random temporary passwords that satisfy the password policy. */
export interface TemporaryPasswordGeneratorPort {
  generate(): string;
}

export const TEMPORARY_PASSWORD_GENERATOR = Symbol('TemporaryPasswordGeneratorPort');
