import { createHash, randomUUID, sign as rsaSign, type X509Certificate } from 'node:crypto';
import type { ClockPort } from '../../../../../shared/application/ports/clock.port.js';
import { ExternalServiceError } from '../../../../../shared/domain/domain-error.js';
import { SIGNATURE_PLACEHOLDER } from '../../../application/ports/ubl-document-builder.port.js';
import type { XmlSignerPort } from '../../../application/ports/xml-signer.port.js';
import { toBogotaTimestamp } from '../../../domain/bogota-time.js';
import { C14N_INCLUSIVE, canonicalize } from '../../xml/c14n.js';
import { findByAttribute, findFirst, type ParsedElement, parseXml } from '../../xml/xml-parser.js';
import { escapeText } from '../../xml/xml-writer.js';
import type { SigningCredentialsSource } from './pem-certificate-store.js';

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES = 'http://uri.etsi.org/01903/v1.3.2#';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
/** DIAN signature policy v2 and the SHA-256 of its PDF. */
const POLICY_URL = 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf';
const POLICY_HASH = 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y=';
const SIGNATURE_VALUE_MARK = '__SIGNATURE_VALUE__';

export const sha256Base64 = (data: string | Buffer): string => createHash('sha256').update(data).digest('base64');

/**
 * XAdES-EPES enveloped signature required by the DIAN (legacy `XmlSigner.php`, §4):
 * RSA-SHA256, inclusive C14N, three references (document with the
 * enveloped-signature transform, `KeyInfo`, `SignedProperties`), signing
 * time in Bogotá, signer role `supplier` and the DIAN policy v2.
 *
 * Digests of `KeyInfo`, `SignedProperties` and `SignedInfo` are computed on
 * the signature placed in the document, so their canonical form inherits the
 * root namespaces as a verifier will see them. Corrections: serial number
 * always in decimal, issuer name in RFC 4514 order with every attribute, and
 * identifiers from `crypto.randomUUID()`.
 */
export class XadesSigner implements XmlSignerPort {
  constructor(
    private readonly credentialsSource: SigningCredentialsSource,
    private readonly clock: ClockPort,
  ) {}

  async sign(xml: string): Promise<string> {
    const parts = xml.split(SIGNATURE_PLACEHOLDER);
    if (parts.length !== 2) {
      throw new ExternalServiceError('Firma', 'el XML debe contener exactamente un marcador de firma.');
    }
    const credentials = await this.credentialsSource.credentials();
    const id = `xmldsig-${randomUUID()}`;
    const documentDigest = sha256Base64(canonicalize(parseXml(parts.join(''))));
    const signedProperties = this.signedProperties(id, credentials.certificate);
    const keyInfo = `<ds:KeyInfo Id="${id}-keyinfo"><ds:X509Data><ds:X509Certificate>${credentials.certificateBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`;

    // Pass 1: place the signature to digest KeyInfo and SignedProperties in context.
    const draft = parseXml(
      parts.join(this.signature(id, this.signedInfo(id, documentDigest, '', ''), keyInfo, signedProperties)),
    );
    const keyInfoDigest = sha256Base64(canonicalize(elementById(draft, `${id}-keyinfo`)));
    const signedPropsDigest = sha256Base64(canonicalize(elementById(draft, `${id}-signedprops`)));

    // Pass 2: canonical SignedInfo in context, then RSA-SHA256.
    const signedInfo = this.signedInfo(id, documentDigest, keyInfoDigest, signedPropsDigest);
    const signed = parts.join(this.signature(id, signedInfo, keyInfo, signedProperties));
    const signature = findByAttribute(parseXml(signed), 'Id', id) as ParsedElement;
    const canonicalSignedInfo = canonicalize(childNamed(signature, 'SignedInfo'));
    const value = rsaSign('sha256', Buffer.from(canonicalSignedInfo, 'utf8'), credentials.privateKey).toString(
      'base64',
    );
    return signed.replace(SIGNATURE_VALUE_MARK, value);
  }

  private signedInfo(id: string, documentDigest: string, keyInfoDigest: string, signedPropsDigest: string): string {
    return (
      `<ds:SignedInfo><ds:CanonicalizationMethod Algorithm="${C14N_INCLUSIVE}"/><ds:SignatureMethod Algorithm="${RSA_SHA256}"/>` +
      `<ds:Reference Id="${id}-ref0" URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED}"/></ds:Transforms>` +
      `<ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${documentDigest}</ds:DigestValue></ds:Reference>` +
      `<ds:Reference URI="#${id}-keyinfo"><ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${keyInfoDigest}</ds:DigestValue></ds:Reference>` +
      `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${id}-signedprops"><ds:DigestMethod Algorithm="${SHA256}"/>` +
      `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`
    );
  }

  private signedProperties(id: string, certificate: X509Certificate): string {
    return (
      `<xades:SignedProperties Id="${id}-signedprops"><xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${toBogotaTimestamp(this.clock.now())}</xades:SigningTime>` +
      `<xades:SigningCertificate><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${SHA256}"/>` +
      `<ds:DigestValue>${sha256Base64(certificate.raw)}</ds:DigestValue></xades:CertDigest>` +
      `<xades:IssuerSerial><ds:X509IssuerName>${escapeText(issuerName(certificate))}</ds:X509IssuerName>` +
      `<ds:X509SerialNumber>${BigInt(`0x${certificate.serialNumber}`).toString()}</ds:X509SerialNumber></xades:IssuerSerial>` +
      `</xades:Cert></xades:SigningCertificate>` +
      `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId><xades:SigPolicyId><xades:Identifier>${POLICY_URL}</xades:Identifier></xades:SigPolicyId>` +
      `<xades:SigPolicyHash><ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${POLICY_HASH}</ds:DigestValue></xades:SigPolicyHash>` +
      `</xades:SignaturePolicyId></xades:SignaturePolicyIdentifier>` +
      `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>supplier</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>` +
      `</xades:SignedSignatureProperties></xades:SignedProperties>`
    );
  }

  private signature(id: string, signedInfo: string, keyInfo: string, signedProperties: string): string {
    return (
      `<ds:Signature xmlns:ds="${DS}" Id="${id}">${signedInfo}` +
      `<ds:SignatureValue Id="${id}-sigvalue">${SIGNATURE_VALUE_MARK}</ds:SignatureValue>${keyInfo}` +
      `<ds:Object><xades:QualifyingProperties xmlns:xades="${XADES}" Target="#${id}">${signedProperties}` +
      `</xades:QualifyingProperties></ds:Object></ds:Signature>`
    );
  }
}

/**
 * RFC 4514 distinguished name (most specific attribute first), keeping every
 * attribute. Node already escapes special characters in `X509Certificate.issuer`.
 */
export function issuerName(certificate: X509Certificate): string {
  return certificate.issuer
    .split('\n')
    .filter(Boolean)
    .reverse()
    .map((attribute) => attribute.replace(/^emailAddress=/, 'E='))
    .join(',');
}

function elementById(root: ParsedElement, id: string): ParsedElement {
  const element = findByAttribute(root, 'Id', id);
  if (!element) throw new ExternalServiceError('Firma', `no se encontró el elemento ${id}.`);
  return element;
}

function childNamed(element: ParsedElement, localName: string): ParsedElement {
  const child = findFirst(element, localName);
  if (!child) throw new ExternalServiceError('Firma', `no se encontró ${localName}.`);
  return child;
}
