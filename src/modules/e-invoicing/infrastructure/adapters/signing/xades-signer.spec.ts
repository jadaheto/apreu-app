import { createHash, verify } from 'node:crypto';
import { FixedClock } from '../../../../../shared/testing/fakes.js';
import { SIGNATURE_PLACEHOLDER } from '../../../application/ports/ubl-document-builder.port.js';
import { createTestCertificate, type TestCertificate } from '../../../testing/self-signed-certificate.js';
import { canonicalize } from '../../xml/c14n.js';
import {
  attributeOf,
  findAll,
  findByAttribute,
  findFirst,
  localNameOf,
  parseXml,
  textContent,
} from '../../xml/xml-parser.js';
import { issuerName, XadesSigner } from './xades-signer.js';

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('base64');

describe('XadesSigner', () => {
  let certificate: TestCertificate;
  let signer: XadesSigner;
  const unsigned =
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:cbc" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:ext" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">\n' +
    '  <ext:UBLExtensions>\n    <ext:UBLExtension>\n      <ext:ExtensionContent>\n        ' +
    SIGNATURE_PLACEHOLDER +
    '\n      </ext:ExtensionContent>\n    </ext:UBLExtension>\n  </ext:UBLExtensions>\n' +
    '  <cbc:ID>SETP990000001</cbc:ID>\n  <cbc:Note>Pensión &amp; transporte</cbc:Note>\n</Invoice>\n';

  beforeAll(() => {
    certificate = createTestCertificate();
    signer = new XadesSigner(
      {
        credentials: async () => ({
          privateKey: certificate.privateKey,
          certificate: certificate.certificate,
          certificateBase64: certificate.certificate.raw.toString('base64'),
        }),
      },
      new FixedClock(new Date('2026-03-15T15:48:27.658Z')),
    );
  });

  it('produces an enveloped XAdES-EPES signature that verifies independently', async () => {
    const signed = await signer.sign(unsigned);
    const root = parseXml(signed);
    const signature = findFirst(root, 'Signature')!;
    const references = findAll(signature, 'Reference');
    const digestOf = (index: number) => textContent(findFirst(references[index], 'DigestValue')!);

    // Reference 0: whole document without the Signature element (enveloped transform), inclusive C14N.
    expect(attributeOf(references[0], 'URI')).toBe('');
    expect(digestOf(0)).toBe(sha256(canonicalize(root, { exclude: (e) => e === signature })));
    // The bytes outside the signature are exactly the unsigned document.
    expect(signed.replace(/<ds:Signature[\s\S]*<\/ds:Signature>/, SIGNATURE_PLACEHOLDER)).toBe(unsigned);

    // References 1 and 2: KeyInfo and SignedProperties digested in context.
    const id = attributeOf(signature, 'Id')!;
    expect(id).toMatch(/^xmldsig-[0-9a-f-]{36}$/);
    expect(digestOf(1)).toBe(sha256(canonicalize(findByAttribute(root, 'Id', `${id}-keyinfo`)!)));
    expect(digestOf(2)).toBe(sha256(canonicalize(findByAttribute(root, 'Id', `${id}-signedprops`)!)));
    expect(canonicalize(findFirst(signature, 'KeyInfo')!)).toMatch(
      /^<ds:KeyInfo xmlns="urn:oasis[^>]+xmlns:xades="http:\/\/uri.etsi.org\/01903\/v1.3.2#" Id=/,
    );

    // SignatureValue: RSA-SHA256 over the canonical SignedInfo.
    const signatureValue = Buffer.from(textContent(findFirst(signature, 'SignatureValue')!), 'base64');
    expect(
      verify(
        'sha256',
        Buffer.from(canonicalize(findFirst(signature, 'SignedInfo')!)),
        certificate.certificate.publicKey,
        signatureValue,
      ),
    ).toBe(true);
  });

  it('includes signing time in Bogotá, certificate digest, decimal serial and the DIAN policy', async () => {
    const signature = findFirst(parseXml(await signer.sign(unsigned)), 'Signature')!;
    const text = (name: string) => textContent(findFirst(signature, name)!);
    expect(text('SigningTime')).toBe('2026-03-15T10:48:27.658-05:00');
    expect(text('X509SerialNumber')).toBe(BigInt('0x4f1c2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b').toString());
    expect(text('X509IssuerName')).toBe('CN=Prueba,OU=FE,O=Colegio de Pruebas,L=Sincelejo,ST=Sucre,C=CO');
    expect(text('X509Certificate')).toBe(certificate.certificate.raw.toString('base64'));
    expect(textContent(findFirst(findFirst(signature, 'CertDigest')!, 'DigestValue')!)).toBe(
      sha256(certificate.certificate.raw),
    );
    expect(text('Identifier')).toBe('https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf');
    expect(text('ClaimedRole')).toBe('supplier');
    expect(findAll(signature, 'Reference').map((r) => localNameOf(r.name))).toHaveLength(3);
  });

  it('requires exactly one placeholder', async () => {
    await expect(signer.sign('<a/>')).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
  });

  it('escapes RFC 4514 special characters in the issuer name', () => {
    const cert = createTestCertificate({
      subject: [
        ['C', 'CO'],
        ['O', 'Camerfirma, S.A.'],
        ['CN', 'AC "Raíz"'],
      ],
    }).certificate;
    expect(issuerName(cert)).toBe('CN=AC \\"Raíz\\",O=Camerfirma\\, S.A.,C=CO');
  });
});
