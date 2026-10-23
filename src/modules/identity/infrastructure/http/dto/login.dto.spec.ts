import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from './login.dto.js';

describe('LoginDto', () => {
  it('accepts an e-mail with surrounding spaces and upper case (trimmed before validation)', () => {
    const dto = plainToInstance(LoginDto, { email: '  DIRECTOR@Demo.CO ', password: 'x' });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.email).toBe('DIRECTOR@Demo.CO');
  });

  it('still rejects an invalid e-mail', () => {
    const dto = plainToInstance(LoginDto, { email: 'no-es-correo', password: 'x' });
    expect(validateSync(dto).map((error) => error.property)).toEqual(['email']);
  });
});
