import { createHash, randomUUID, sign as rsaSign } from 'node:crypto';
import { C14N_EXCLUSIVE, canonicalize } from '../../xml/c14n.js';
import { findByAttribute, findFirst, type ParsedElement, parseXml } from '../../xml/xml-parser.js';
import { escapeText } from '../../xml/xml-writer.js';
import type { SigningCredentials } from '../signing/pem-certificate-store.js';
import { sha256Base64 } from '../signing/xades-signer.js';

const SOAP = 'http://www.w3.org/2003/05/soap-envelope';
const WCF = 'http://wcf.dian.colombia';
const WSA = 'http://www.w3.org/2005/08/addressing';
const WSU = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';
const WSSE = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
const DS = 'http://www.w3.org/2000/09/xmldsig#';
const BASE64_BINARY = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary';
const X509_TOKEN = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3';
const THUMBPRINT = 'http://docs.oasis-open.org/wss/oasis-wss-soap-message-security-1.1#ThumbprintSHA1';
const SIGNATURE_VALUE_MARK = '__WSS_SIGNATURE__';
/** Validity of the WS-Security timestamp. */
const TIMESTAMP_TTL_MS = 5 * 60 * 1000;

export const soapAction = (method: string): string => `${WCF}/IWcfDianCustomerServices/${method}`;

export interface EnvelopeInput {
  method: string;
  /** Operation parameters in WSDL order. */
  params: [string, string][];
  url: string;
  credentials: SigningCredentials;
  now: Date;
}

/**
 * SOAP 1.2 envelope with WS-Addressing and WS-Security (legacy
 * `DianClient::buildSoapEnvelope`): X.509 BinarySecurityToken, signature over
 * `wsu:Timestamp` and `wsa:To` with exclusive C14N and RSA-SHA256, key
 * referenced by SHA-1 thumbprint.
 */
export function buildSoapEnvelope(input: EnvelopeInput): string {
  const created = input.now.toISOString();
  const expires = new Date(input.now.getTime() + TIMESTAMP_TTL_MS).toISOString();
  const body = input.params.map(([name, value]) => `<wcf:${name}>${escapeText(value)}</wcf:${name}>`).join('');
  const thumbprint = createHash('sha1').update(input.credentials.certificate.raw).digest('base64');

  const envelope = (signedInfo: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="${SOAP}" xmlns:wcf="${WCF}" xmlns:wsa="${WSA}" xmlns:wsu="${WSU}"><soap:Header>` +
    `<wsa:Action soap:mustUnderstand="1">${soapAction(input.method)}</wsa:Action>` +
    `<wsa:To soap:mustUnderstand="1" wsu:Id="_1">${escapeText(input.url)}</wsa:To>` +
    `<wsse:Security xmlns:wsse="${WSSE}" soap:mustUnderstand="1">` +
    `<wsu:Timestamp wsu:Id="_0"><wsu:Created>${created}</wsu:Created><wsu:Expires>${expires}</wsu:Expires></wsu:Timestamp>` +
    `<wsse:BinarySecurityToken EncodingType="${BASE64_BINARY}" ValueType="${X509_TOKEN}" wsu:Id="uuid-${randomUUID()}-1">${input.credentials.certificateBase64}</wsse:BinarySecurityToken>` +
    `<ds:Signature xmlns:ds="${DS}">${signedInfo}<ds:SignatureValue>${SIGNATURE_VALUE_MARK}</ds:SignatureValue>` +
    `<ds:KeyInfo><wsse:SecurityTokenReference><wsse:KeyIdentifier EncodingType="${BASE64_BINARY}" ValueType="${THUMBPRINT}">${thumbprint}</wsse:KeyIdentifier></wsse:SecurityTokenReference></ds:KeyInfo>` +
    `</ds:Signature></wsse:Security></soap:Header>` +
    `<soap:Body><wcf:${input.method}>${body}</wcf:${input.method}></soap:Body></soap:Envelope>`;

  const draft = parseXml(envelope(''));
  const signedInfo = buildSignedInfo([
    ['_0', sha256Base64(canonicalize(byWsuId(draft, '_0'), { exclusive: true }))],
    ['_1', sha256Base64(canonicalize(byWsuId(draft, '_1'), { exclusive: true }))],
  ]);
  const signed = envelope(signedInfo);
  const canonicalSignedInfo = canonicalize(findFirst(parseXml(signed), 'SignedInfo') as ParsedElement, {
    exclusive: true,
  });
  const value = rsaSign('sha256', Buffer.from(canonicalSignedInfo, 'utf8'), input.credentials.privateKey).toString(
    'base64',
  );
  return signed.replace(SIGNATURE_VALUE_MARK, value);
}

function buildSignedInfo(references: [string, string][]): string {
  const refs = references
    .map(
      ([id, digest]) =>
        `<ds:Reference URI="#${id}"><ds:Transforms><ds:Transform Algorithm="${C14N_EXCLUSIVE}"/></ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${digest}</ds:DigestValue></ds:Reference>`,
    )
    .join('');
  return (
    `<ds:SignedInfo><ds:CanonicalizationMethod Algorithm="${C14N_EXCLUSIVE}"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>${refs}</ds:SignedInfo>`
  );
}

function byWsuId(root: ParsedElement, id: string): ParsedElement {
  const element = findByAttribute(root, 'wsu:Id', id);
  if (!element) throw new Error(`Elemento wsu:Id="${id}" no encontrado en el sobre SOAP.`);
  return element;
}
