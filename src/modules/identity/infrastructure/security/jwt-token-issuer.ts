import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from '../../../../shared/infrastructure/security/access-token.js';
import type { IssuedToken, TokenIssuerPort, TokenSubject } from '../../application/ports/token-issuer.port.js';

@Injectable()
export class JwtTokenIssuer implements TokenIssuerPort {
  constructor(private readonly jwt: JwtService) {}

  async issue(subject: TokenSubject): Promise<IssuedToken> {
    const claims: AccessTokenClaims = {
      sub: subject.userId,
      role: subject.role,
      email: subject.email,
      name: subject.name,
      tenant: subject.tenant,
    };
    const accessToken = await this.jwt.signAsync(claims);
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(accessToken);
    return { accessToken, expiresIn: exp - iat };
  }
}
