import type { DianEnvironment } from '../../domain/catalogs.js';
import type { DianResponse } from '../../domain/dian-response.js';

/**
 * DIAN web service (`WcfDianCustomerServices`, SOAP 1.2 + WS-Security).
 * Transport failures (network, timeout, HTTP errors) throw
 * `ExternalServiceError`; a DIAN validation answer is always returned as data.
 */
export interface DianGatewayPort {
  sendBillSync(environment: DianEnvironment, zipFileName: string, zip: Buffer): Promise<DianResponse>;
  sendTestSetAsync(
    environment: DianEnvironment,
    zipFileName: string,
    zip: Buffer,
    testSetId: string,
  ): Promise<DianResponse>;
  /** Status of an asynchronous submission; the returned ZIP is already uncompressed. */
  getStatusZip(environment: DianEnvironment, trackId: string): Promise<DianResponse>;
}

export const DIAN_GATEWAY = Symbol('DianGatewayPort');
