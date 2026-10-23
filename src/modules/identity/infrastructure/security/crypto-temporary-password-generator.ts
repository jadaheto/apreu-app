import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { TemporaryPasswordGeneratorPort } from '../../application/ports/temporary-password-generator.port.js';

// Ambiguous characters (0/O, 1/l/I) are excluded so the password can be dictated.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '#$%*+-=?@';
const ALPHABET = LETTERS + DIGITS + SYMBOLS;
const LENGTH = 14;

/**
 * Cryptographically secure temporary passwords (replaces the fixed
 * `Apreu2024!` of the legacy provisioning, ADR-0005). Always contains at least
 * one letter, one digit and one symbol, so it satisfies the password policy.
 */
@Injectable()
export class CryptoTemporaryPasswordGenerator implements TemporaryPasswordGeneratorPort {
  generate(): string {
    const pick = (chars: string) => chars.charAt(randomInt(chars.length));
    const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)];
    while (chars.length < LENGTH) chars.push(pick(ALPHABET));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
    }
    return chars.join('');
  }
}
