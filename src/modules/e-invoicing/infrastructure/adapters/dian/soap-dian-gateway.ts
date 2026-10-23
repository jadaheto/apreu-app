import type { ClockPort } from '../../../../../shared/application/ports/clock.port.js';
import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import type { DianGatewayPort } from '../../../application/ports/dian-gateway.port.js';
import type { DianEnvironment } from '../../../domain/catalogs.js';
import type { DianResponse } from '../../../domain/dian-response.js';
import type { SigningCredentialsSource } from '../signing/pem-certificate-store.js';
import { parseDianResponse, SoapFaultError } from './dian-response-parser.js';
import { buildSoapEnvelope, soapAction } from './soap-envelope.js';

/** Web-service URL per environment. */
export const DIAN_ENDPOINTS: Record<DianEnvironment, string> = {
  '1': 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
  '2': 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
};

export interface RetryPolicy {
  /** Total attempts per call (1 = no retry). */
  attempts: number;
  /** First back-off; doubles on each retry. */
  baseDelayMs: number;
  timeoutMs: number;
  sleep: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 2_000,
  timeoutMs: 120_000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** HTTP statuses worth retrying (gateway/availability problems). */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

type Fetch = typeof fetch;

/**
 * DIAN SOAP client over `fetch` (legacy `DianClient.php` with cURL).
 *
 * - TLS verification is the platform default (never disabled).
 * - Network errors, timeouts and 502/503/504 are retried with exponential
 *   back-off and a fresh WS-Security timestamp; validation answers are never retried.
 * - Request/response bodies are not written to disk (the legacy dumped them,
 *   with personal data and the certificate, inside the web root).
 * - Exhausted retries, SOAP faults and other HTTP errors raise `ExternalServiceError`.
 */
export class SoapDianGateway implements DianGatewayPort {
  constructor(
    private readonly credentialsSource: SigningCredentialsSource,
    private readonly clock: ClockPort,
    private readonly fetcher: Fetch = fetch,
    private readonly retry: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {}

  sendBillSync(environment: DianEnvironment, zipFileName: string, zip: Buffer): Promise<DianResponse> {
    return this.call(environment, 'SendBillSync', [
      ['fileName', zipFileName],
      ['contentFile', zip.toString('base64')],
    ]);
  }

  sendTestSetAsync(
    environment: DianEnvironment,
    zipFileName: string,
    zip: Buffer,
    testSetId: string,
  ): Promise<DianResponse> {
    return this.call(environment, 'SendTestSetAsync', [
      ['fileName', zipFileName],
      ['contentFile', zip.toString('base64')],
      ['testSetId', testSetId],
    ]);
  }

  getStatusZip(environment: DianEnvironment, trackId: string): Promise<DianResponse> {
    return this.call(environment, 'GetStatusZip', [['trackId', trackId]]);
  }

  private async call(environment: DianEnvironment, method: string, params: [string, string][]): Promise<DianResponse> {
    const url = DIAN_ENDPOINTS[environment];
    const credentials = await this.credentialsSource.credentials();
    let lastError = '';
    for (let attempt = 1; attempt <= this.retry.attempts; attempt++) {
      if (attempt > 1) await this.retry.sleep(this.retry.baseDelayMs * 2 ** (attempt - 2));
      const envelope = buildSoapEnvelope({ method, params, url, credentials, now: this.clock.now() });
      let response: Response;
      try {
        response = await this.fetcher(url, {
          method: 'POST',
          headers: { 'Content-Type': `application/soap+xml;charset=UTF-8;action="${soapAction(method)}"` },
          body: envelope,
          signal: AbortSignal.timeout(this.retry.timeoutMs),
        });
      } catch (error) {
        lastError = `sin respuesta de la DIAN (${(error as Error).message})`;
        continue;
      }
      const text = await response.text();
      if (RETRYABLE_STATUSES.has(response.status)) {
        lastError = `la DIAN respondió HTTP ${response.status}`;
        continue;
      }
      return this.interpret(method, response.status, text);
    }
    throw new ExternalServiceError('DIAN', `${method}: ${lastError}`, { method, attempts: this.retry.attempts });
  }

  private interpret(method: string, status: number, text: string): DianResponse {
    try {
      const parsed = parseDianResponse(text);
      if (status < 200 || status >= 300) throw new SoapFaultError(`HTTP ${status}`);
      return parsed;
    } catch (error) {
      const reason = error instanceof SoapFaultError ? error.message : `respuesta inválida (HTTP ${status})`;
      throw new ExternalServiceError('DIAN', `${method}: ${reason}`, { method, httpStatus: status });
    }
  }
}
