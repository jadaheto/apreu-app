import { assertStrongPassword } from './password-policy.js';

describe('assertStrongPassword', () => {
  it.each(['corta1', 'sololetras', '12345678', ''])('rejects "%s"', (password) => {
    expect(() => assertStrongPassword(password)).toThrow(expect.objectContaining({ code: 'WEAK_PASSWORD' }));
  });

  it('accepts letters plus digits with 8+ characters', () => {
    expect(() => assertStrongPassword('Colegio2026')).not.toThrow();
  });
});
