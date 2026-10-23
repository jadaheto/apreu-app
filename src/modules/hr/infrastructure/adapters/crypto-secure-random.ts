import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SecureRandomPort } from '../../application/ports/secure-random.port.js';

/** Unambiguous alphabet (no 0/O, 1/l/I). */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const pick = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');

/** {@link SecureRandomPort} backed by `node:crypto`. */
@Injectable()
export class CryptoSecureRandom implements SecureRandomPort {
  /** 12 characters with at least one letter and one digit (satisfies identity's password policy). */
  temporaryPassword(): string {
    const chars = [...pick(LETTERS, 8), ...pick(DIGITS, 4)];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  /** 16 random characters (~80 bits) grouped as `XXXX-XXXX-XXXX-XXXX`. */
  verificationCode(): string {
    return pick(CODE_ALPHABET, 16).match(/.{4}/g)!.join('-');
  }
}
