import type { DocumentType } from './catalogs.js';

/**
 * File naming convention for the XML sent to the DIAN.
 * - `annex`: Anexo Técnico — `{fv|nc|nd}{NIT 10}{ppp}{aa}{8 hex}` and ZIP prefixed with `z`.
 * - `legacy`: names produced by `FileNaming.php` (8 chars of the software id,
 *   4-digit year, unpadded hex, ZIP with the same name), kept to reproduce
 *   historical files.
 */
export type FileNamingMode = 'annex' | 'legacy';
export const FILE_NAMING_MODES: readonly FileNamingMode[] = ['annex', 'legacy'];

export interface FileNameInput {
  mode: FileNamingMode;
  type: DocumentType;
  issuerNit: string;
  consecutive: number;
  /** Year of issue (annex) — the legacy used the server's current year. */
  year: number;
  /** Technology provider code (`000` for own software). */
  providerCode: string;
  softwareId: string;
}

export interface DianFileNames {
  /** Base name without extension. */
  xml: string;
  zip: string;
}

export function dianFileNames(input: FileNameInput): DianFileNames {
  const nit = input.issuerNit.padStart(10, '0');
  const hex = input.consecutive.toString(16).toLowerCase();
  if (input.mode === 'legacy') {
    const name = `${input.type}${nit}${input.softwareId.replace(/-/g, '').slice(0, 8)}${input.year}${hex}`;
    return { xml: name, zip: name };
  }
  const name = `${nit}${input.providerCode.padStart(3, '0').slice(-3)}${String(input.year).slice(-2)}${hex.padStart(8, '0').slice(-8)}`;
  return { xml: `${input.type}${name}`, zip: `z${name}` };
}
