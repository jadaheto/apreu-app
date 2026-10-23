import { verify } from 'node:crypto';
import { FixedClock } from '../../../../../shared/testing/fakes.js';
import { createTestCertificate, type TestCertificate } from '../../../testing/self-signed-certificate.js';
import { canonicalize } from '../../xml/c14n.js';
import { attributeOf, findAll, findByAttribute, findFirst, parseXml, textContent } from '../../xml/xml-parser.js';
import { writeZip } from '../zip/zip-archiver.js';
import { sha256Base64 } from '../signing/xades-signer.js';
import { parseDianResponse } from './dian-response-parser.js';
import { buildSoapEnvelope } from './soap-envelope.js';
import { DIAN_ENDPOINTS, SoapDianGateway } from './soap-dian-gateway.js';

let certificate: TestCertificate;
const credentials = () => ({
  privateKey: certificate.privateKey,
  certificate: certificate.certificate,
  certificateBase64: certificate.certificate.raw.toString('base64'),
});
beforeAll(() => {
  certificate = createTestCertificate();
});

const B = 'http://schemas.datacontract.org/2004/07/DianResponse';
const C = 'http://schemas.microsoft.com/2003/10/Serialization/Arrays';
const soapResponse = (operation: string, result: string) =>
  `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Header/><s:Body><${operation}Response xmlns="http://wcf.dian.colombia"><${operation}Result xmlns:b="${B}" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">${result}</${operation}Result></${operation}Response></s:Body></s:Envelope>`;
const appResponse =
  '<ApplicationResponse xmlns:cbc="urn:cbc" xmlns:cac="urn:cac"><cac:DocumentResponse><cac:Response><cbc:ResponseCode>02</cbc:ResponseCode></cac:Response></cac:DocumentResponse></ApplicationResponse>';

describe('buildSoapEnvelope', () => {
  it('signs Timestamp and To with exclusive C14N and RSA-SHA256 (WS-Security)', () => {
    const xml = buildSoapEnvelope({
      method: 'SendBillSync',
      params: [
        ['fileName', 'z1.zip'],
        ['contentFile', 'UEsD<&>'],
      ],
      url: DIAN_ENDPOINTS['2'],
      credentials: credentials(),
      now: new Date('2026-03-15T15:00:00.000Z'),
    });
    const root = parseXml(xml);
    expect(textContent(findFirst(root, 'Action')!)).toBe(
      'http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync',
    );
    expect(textContent(findFirst(root, 'Created')!)).toBe('2026-03-15T15:00:00.000Z');
    expect(textContent(findFirst(root, 'Expires')!)).toBe('2026-03-15T15:05:00.000Z');
    expect(textContent(findFirst(root, 'contentFile')!)).toBe('UEsD<&>');
    expect(textContent(findFirst(root, 'BinarySecurityToken')!)).toBe(certificate.certificate.raw.toString('base64'));

    const [timestampRef, toRef] = findAll(root, 'Reference');
    expect(attributeOf(timestampRef, 'URI')).toBe('#_0');
    const timestamp = findByAttribute(root, 'wsu:Id', '_0')!;
    const to = findByAttribute(root, 'wsu:Id', '_1')!;
    expect(canonicalize(to, { exclusive: true })).toBe(
      `<wsa:To xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="_1" soap:mustUnderstand="1">${DIAN_ENDPOINTS['2']}</wsa:To>`,
    );
    expect(textContent(findFirst(timestampRef, 'DigestValue')!)).toBe(
      sha256Base64(canonicalize(timestamp, { exclusive: true })),
    );
    expect(textContent(findFirst(toRef, 'DigestValue')!)).toBe(sha256Base64(canonicalize(to, { exclusive: true })));

    const signedInfo = canonicalize(findFirst(root, 'SignedInfo')!, { exclusive: true });
    expect(
      signedInfo.startsWith(
        '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></ds:CanonicalizationMethod>',
      ),
    ).toBe(true);
    const value = Buffer.from(textContent(findFirst(root, 'SignatureValue')!), 'base64');
    expect(verify('sha256', Buffer.from(signedInfo), certificate.certificate.publicKey, value)).toBe(true);
  });
});

describe('parseDianResponse', () => {
  it('reads a SendBillSync answer with rules and the ApplicationResponse', () => {
    const response = parseDianResponse(
      soapResponse(
        'SendBillSync',
        `<b:ErrorMessage xmlns:c="${C}"><c:string>Regla: FAK61, Rechazo: x</c:string><c:string>Regla: RUT01, Notificación: y</c:string></b:ErrorMessage>` +
          `<b:IsValid>false</b:IsValid><b:StatusCode>99</b:StatusCode><b:StatusDescription>Validación contiene errores en campos mandatorios.</b:StatusDescription>` +
          `<b:StatusMessage>La Factura electrónica SETP1, ha sido rechazada.</b:StatusMessage>` +
          `<b:XmlBase64Bytes>${Buffer.from(appResponse).toString('base64')}</b:XmlBase64Bytes><b:XmlBytes i:nil="true"/><b:XmlDocumentKey>cufe-1</b:XmlDocumentKey><b:XmlFileName>fv1</b:XmlFileName>`,
      ),
    );
    expect(response).toEqual({
      statusCode: '99',
      statusDescription: 'Validación contiene errores en campos mandatorios.',
      isValid: false,
      messages: ['Regla: FAK61, Rechazo: x', 'Regla: RUT01, Notificación: y'],
      trackId: 'cufe-1',
      applicationResponse: appResponse,
      applicationResponseCode: '02',
    });
  });

  it('uncompresses the ZIP returned by GetStatusZip', () => {
    const zip = writeZip([{ name: 'ar.xml', content: Buffer.from(appResponse) }]);
    const response = parseDianResponse(
      soapResponse(
        'GetStatusZip',
        `<b:DianResponse><b:IsValid>true</b:IsValid><b:StatusCode>00</b:StatusCode><b:XmlBase64Bytes>${zip.toString('base64')}</b:XmlBase64Bytes></b:DianResponse>`,
      ),
    );
    expect(response).toMatchObject({
      statusCode: '00',
      isValid: true,
      applicationResponse: appResponse,
      applicationResponseCode: '02',
    });
  });

  it('reads the ZipKey and failed items of SendTestSetAsync', () => {
    const response = parseDianResponse(
      soapResponse(
        'SendTestSetAsync',
        '<b:ErrorMessageList><b:XmlParamsResponseTrackId><b:ProcessedMessage>Archivo inválido</b:ProcessedMessage><b:Success>false</b:Success></b:XmlParamsResponseTrackId><b:XmlParamsResponseTrackId><b:ProcessedMessage>ok</b:ProcessedMessage><b:Success>true</b:Success></b:XmlParamsResponseTrackId></b:ErrorMessageList><b:ZipKey>zip-123</b:ZipKey>',
      ),
    );
    expect(response).toMatchObject({
      statusCode: null,
      trackId: 'zip-123',
      messages: ['Archivo inválido'],
      isValid: null,
    });
  });

  it('raises SOAP faults', () => {
    expect(() =>
      parseDianResponse(
        '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault><s:Reason><s:Text>Acceso denegado</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>',
      ),
    ).toThrow('Acceso denegado');
  });
});

describe('SoapDianGateway', () => {
  const ok = soapResponse(
    'SendBillSync',
    '<b:IsValid>true</b:IsValid><b:StatusCode>00</b:StatusCode><b:XmlDocumentKey>cufe-1</b:XmlDocumentKey>',
  );
  const policy = (sleep = vi.fn(async () => undefined)) => ({ attempts: 3, baseDelayMs: 10, timeoutMs: 1000, sleep });
  const gatewayWith = (fetcher: typeof fetch, sleep = vi.fn(async () => undefined)) =>
    new SoapDianGateway({ credentials: async () => credentials() }, new FixedClock(), fetcher, policy(sleep));

  it('posts a SOAP 1.2 request to the environment endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(ok, { status: 200 }));
    const response = await gatewayWith(fetcher as unknown as typeof fetch).sendBillSync(
      '1',
      'z1.zip',
      Buffer.from('zip'),
    );
    expect(response).toMatchObject({ statusCode: '00', trackId: 'cufe-1' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://vpfe.dian.gov.co/WcfDianCustomerServices.svc');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/soap+xml;charset=UTF-8;action="http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillSync"',
    );
    expect(String(init.body)).toContain(`<wcf:contentFile>${Buffer.from('zip').toString('base64')}</wcf:contentFile>`);
  });

  it('sends the TestSetId and queries GetStatusZip', async () => {
    const fetcher = vi.fn(async () => new Response(ok, { status: 200 }));
    const gateway = gatewayWith(fetcher as unknown as typeof fetch);
    await gateway.sendTestSetAsync('2', 'z1.zip', Buffer.from('zip'), 'test-set-1');
    await gateway.getStatusZip('2', 'zip-1');
    const bodies = fetcher.mock.calls.map((call) => String((call as unknown as [string, RequestInit])[1].body));
    expect(bodies[0]).toContain('<wcf:testSetId>test-set-1</wcf:testSetId>');
    expect(bodies[1]).toContain('<wcf:GetStatusZip><wcf:trackId>zip-1</wcf:trackId></wcf:GetStatusZip>');
  });

  it('retries network errors and 503 with exponential back-off', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response(ok, { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    await expect(
      gatewayWith(fetcher as unknown as typeof fetch, sleep).sendBillSync('2', 'z', Buffer.from('')),
    ).resolves.toMatchObject({ statusCode: '00' });
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('fails with ExternalServiceError after the last attempt, on SOAP faults and invalid answers', async () => {
    const down = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(
      gatewayWith(down as unknown as typeof fetch).sendBillSync('2', 'z', Buffer.from('')),
    ).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
    expect(down).toHaveBeenCalledTimes(3);

    const fault = vi.fn(
      async () =>
        new Response(
          '<s:Envelope xmlns:s="x"><s:Body><s:Fault><s:Reason><s:Text>Certificado no autorizado</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>',
          { status: 500 },
        ),
    );
    await expect(gatewayWith(fault as unknown as typeof fetch).sendBillSync('2', 'z', Buffer.from(''))).rejects.toThrow(
      'Certificado no autorizado',
    );
    expect(fault).toHaveBeenCalledTimes(1);

    const html = vi.fn(async () => new Response('<html>', { status: 404 }));
    await expect(gatewayWith(html as unknown as typeof fetch).sendBillSync('2', 'z', Buffer.from(''))).rejects.toThrow(
      'respuesta inválida (HTTP 404)',
    );
  });
});
