import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENVIRONMENT, type Environment } from '../../../../../shared/infrastructure/config/environment.js';
import type { StudentQrVerifierPort } from '../../application/ports/student-qr-verifier.port.js';

const DERIVATION_LABEL = 'apreu:student-id-card-qr';

/**
 * HMAC-SHA256 verifier shared with the students context (which signs the card).
 * Secret: `Environment.studentQrSecret` (`STUDENT_QR_SECRET`), or `HMAC-SHA256(JWT_SECRET, 'apreu:student-id-card-qr')`
 * when not configured. Comparison is constant-time.
 */
@Injectable()
export class HmacStudentQrVerifier implements StudentQrVerifierPort {
  private readonly secret: Buffer;

  constructor(@Inject(ENVIRONMENT) env: Environment) {
    const configured = env.studentQrSecret;
    this.secret = configured
      ? Buffer.from(configured, 'utf8')
      : createHmac('sha256', env.jwt.secret).update(DERIVATION_LABEL).digest();
  }

  isAuthentic(signedContent: string, signature: string): boolean {
    const expected = createHmac('sha256', this.secret).update(signedContent).digest();
    const given = Buffer.from(signature, 'base64url');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
