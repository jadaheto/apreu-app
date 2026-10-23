import { randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SecretGeneratorPort } from '../../application/ports/secret-generator.port.js';

/** Without look-alike characters (0/O, 1/l/I) so passwords can be dictated. */
const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const PASSWORD_LENGTH = 12;

const pick = (alphabet: string): string => alphabet[randomInt(alphabet.length)];

/** {@link SecretGeneratorPort} backed by Node's CSPRNG (`crypto.randomInt` / `randomBytes`). */
@Injectable()
export class CryptoSecretGenerator implements SecretGeneratorPort {
  temporaryPassword(): string {
    const all = LETTERS + DIGITS;
    const chars = [pick(LETTERS), pick(DIGITS), ...Array.from({ length: PASSWORD_LENGTH - 2 }, () => pick(all))];
    // Fisher–Yates shuffle so the guaranteed letter/digit are not always first.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  verificationCode(): string {
    return randomBytes(18).toString('base64url');
  }
}
