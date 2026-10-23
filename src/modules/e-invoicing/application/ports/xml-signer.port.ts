/**
 * XAdES-EPES enveloped signature (DIAN signature policy v2) of an XML that
 * contains the `SIGNATURE_PLACEHOLDER` comment. Returns the exact bytes to
 * store and send (never re-serialize after signing).
 */
export interface XmlSignerPort {
  sign(xml: string): Promise<string>;
}

export const XML_SIGNER = Symbol('XmlSignerPort');
