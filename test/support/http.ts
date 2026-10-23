import type request from 'supertest';

/** Supertest parser that keeps binary bodies (PDF, XLSX, ZIP) as a Buffer. */
export const asBuffer = (res: request.Response, callback: (err: Error | null, body: Buffer) => void): void => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

/** Asserts the buffer is a PDF document. */
export const isPdf = (body: Buffer): boolean => body.subarray(0, 5).toString('latin1') === '%PDF-';

/** XLSX files are ZIP containers (`PK\x03\x04`). */
export const isZip = (body: Buffer): boolean => body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

const requestOf = (res: request.Response): string => {
  const req = (res as unknown as { req?: { method?: string; path?: string } }).req;
  return `${req?.method ?? ''} ${req?.path ?? ''}`;
};

/** Asserts the HTTP status, showing the response body when it does not match. */
export function expectStatus(res: request.Response, ...expected: number[]): void {
  if (!expected.includes(res.status)) {
    const body = Buffer.isBuffer(res.body) ? `<${res.body.length} bytes>` : JSON.stringify(res.body);
    throw new Error(`HTTP ${res.status} (se esperaba ${expected.join(' o ')}) en ${requestOf(res)}: ${body}`);
  }
}
