import { assertStrongPassword } from '../../domain/password-policy.js';
import { CryptoTemporaryPasswordGenerator } from './crypto-temporary-password-generator.js';

describe('CryptoTemporaryPasswordGenerator', () => {
  const generator = new CryptoTemporaryPasswordGenerator();

  it('generates 14-character passwords that satisfy the password policy', () => {
    for (let i = 0; i < 50; i++) {
      const password = generator.generate();
      expect(password).toHaveLength(14);
      expect(() => assertStrongPassword(password)).not.toThrow();
      expect(password).toMatch(/[#$%*+\-=?@]/);
    }
  });

  it('does not repeat passwords', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generator.generate()));
    expect(passwords.size).toBe(100);
  });
});
