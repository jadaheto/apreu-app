import { createHash } from 'node:crypto';
import { Amounts } from './amounts.js';
import type { DianEnvironment, DocumentType } from './catalogs.js';

/** Inputs of the CUFE/CUDE formula (Anexo Técnico §11.1 / legacy `CufeCalculator.php`). */
export interface UniqueCodeInput {
  type: DocumentType;
  number: string;
  issueDate: string;
  issueTime: string;
  lineExtensionCents: number;
  vatCents: number;
  payableCents: number;
  issuerNit: string;
  customerIdNumber: string;
  /** Technical key of the resolution (CUFE) or software PIN (CUDE). */
  key: string;
  environment: DianEnvironment;
}

const sha384 = (value: string): string => createHash('sha384').update(value, 'utf8').digest('hex');

/**
 * CUFE (invoices) / CUDE (credit and debit notes), lowercase hex SHA-384 of:
 * `NumFac + FecFac + HorFac + ValFac + "01" + ValImp1 + "04" + ValImp2 + "03" + ValImp3 + ValTot + NitOFE + NumAdq + Key + TipoAmbiente`.
 * INC (04) and ICA (03) are always `0.00`. Amounts use exactly the strings
 * emitted in the XML (2 decimals, dot separator).
 */
export function uniqueCodeSeed(input: UniqueCodeInput): string {
  return [
    input.number,
    input.issueDate,
    input.issueTime,
    Amounts.format(input.lineExtensionCents),
    '01',
    Amounts.format(input.vatCents),
    '04',
    '0.00',
    '03',
    '0.00',
    Amounts.format(input.payableCents),
    input.issuerNit,
    input.customerIdNumber,
    input.key,
    input.environment,
  ].join('');
}

export const computeUniqueCode = (input: UniqueCodeInput): string => sha384(uniqueCodeSeed(input));

/** `SoftwareSecurityCode = SHA-384(softwareId + softwarePin + number)`. */
export const computeSoftwareSecurityCode = (softwareId: string, softwarePin: string, number: string): string =>
  sha384(`${softwareId}${softwarePin}${number}`);

/** DIAN catalog URL encoded in the QR code. */
export const qrUrl = (environment: DianEnvironment, uniqueCode: string): string =>
  `https://catalogo-vpfe${environment === '1' ? '' : '-hab'}.dian.gov.co/document/searchqr?documentkey=${uniqueCode}`;

/** Scheme name of the unique code: `CUFE-SHA384` for invoices, `CUDE-SHA384` for notes. */
export const uniqueCodeScheme = (type: DocumentType): 'CUFE-SHA384' | 'CUDE-SHA384' =>
  type === 'fv' ? 'CUFE-SHA384' : 'CUDE-SHA384';
