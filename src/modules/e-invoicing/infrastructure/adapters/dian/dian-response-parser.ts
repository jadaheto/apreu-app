import type { DianResponse } from '../../../domain/dian-response.js';
import {
  childElements,
  findAll,
  findFirst,
  localNameOf,
  type ParsedElement,
  parseXml,
  textContent,
} from '../../xml/xml-parser.js';
import { readZip } from '../zip/zip-archiver.js';

const RESULT_FIELDS = new Set(['StatusCode', 'IsValid', 'ErrorMessage', 'XmlDocumentKey', 'ZipKey']);

/** SOAP Fault returned by the web service (authentication, malformed request…). */
export class SoapFaultError extends Error {}

/**
 * Extracts a {@link DianResponse} from the SOAP answer of SendBillSync,
 * SendTestSetAsync or GetStatusZip, resolving elements by local name (no
 * regex prefix stripping). `XmlBase64Bytes` is decoded and, when it is a ZIP
 * (GetStatusZip), uncompressed; the ApplicationResponse `ResponseCode` is read.
 */
export function parseDianResponse(soap: string): DianResponse {
  const root = parseXml(soap);
  const body = findFirst(root, 'Body');
  if (!body) throw new SoapFaultError('Respuesta SOAP sin Body.');
  const fault = findFirst(body, 'Fault');
  if (fault) {
    const reason = findFirst(fault, 'Text') ?? findFirst(fault, 'Reason') ?? fault;
    throw new SoapFaultError(textContent(reason).trim() || 'SOAP Fault');
  }

  const result = findResult(body);
  if (!result) {
    return {
      statusCode: null,
      statusDescription: null,
      isValid: null,
      messages: [],
      trackId: null,
      applicationResponse: null,
      applicationResponseCode: null,
    };
  }
  const field = (name: string): string | null => {
    const element = childElements(result).find((child) => localNameOf(child.name) === name);
    const value = element ? textContent(element).trim() : '';
    return value || null;
  };
  const isValid = field('IsValid');
  const applicationResponse = decodeApplicationResponse(field('XmlBase64Bytes'));
  return {
    statusCode: field('StatusCode'),
    statusDescription: field('StatusDescription') ?? field('StatusMessage'),
    isValid: isValid === null ? null : isValid === 'true',
    messages: messagesOf(result),
    trackId: field('XmlDocumentKey') ?? field('ZipKey'),
    applicationResponse,
    applicationResponseCode: applicationResponse ? responseCodeOf(applicationResponse) : null,
  };
}

function findResult(element: ParsedElement): ParsedElement | null {
  if (childElements(element).some((child) => RESULT_FIELDS.has(localNameOf(child.name)))) return element;
  for (const child of childElements(element)) {
    const found = findResult(child);
    if (found) return found;
  }
  return null;
}

function messagesOf(result: ParsedElement): string[] {
  const messages: string[] = [];
  for (const child of childElements(result)) {
    const name = localNameOf(child.name);
    if (name === 'ErrorMessage') {
      messages.push(...findAll(child, 'string').map((item) => textContent(item).trim()));
    } else if (name === 'ErrorMessageList') {
      for (const item of childElements(child)) {
        const success = findFirst(item, 'Success');
        const message = findFirst(item, 'ProcessedMessage');
        if (message && (!success || textContent(success).trim() !== 'true')) messages.push(textContent(message).trim());
      }
    }
  }
  return messages.filter(Boolean);
}

function decodeApplicationResponse(base64: string | null): string | null {
  if (!base64) return null;
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.subarray(0, 2).toString('latin1') !== 'PK') return bytes.toString('utf8');
  const entry = readZip(bytes).find((candidate) => candidate.name.toLowerCase().endsWith('.xml'));
  return entry ? entry.content.toString('utf8') : null;
}

function responseCodeOf(applicationResponse: string): string | null {
  try {
    const documentResponse = findFirst(parseXml(applicationResponse), 'DocumentResponse');
    const response =
      documentResponse && childElements(documentResponse).find((child) => localNameOf(child.name) === 'Response');
    const code = response && findFirst(response, 'ResponseCode');
    return code ? textContent(code).trim() : null;
  } catch {
    return null;
  }
}
