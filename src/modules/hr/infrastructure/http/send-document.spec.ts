import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { sendDocument } from './send-document.js';

const responseStub = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    res: { setHeader: (name: string, value: string) => (headers[name] = value) } as unknown as Response,
  };
};

describe('sendDocument', () => {
  it('returns a StreamableFile (a raw Buffer would be serialized as JSON by Nest)', async () => {
    const { headers, res } = responseStub();
    const pdf = Buffer.from('%PDF-1.7 contenido');
    const file = sendDocument(res, { contentType: 'application/pdf', fileName: 'desprendible.pdf', body: pdf });

    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toMatchObject({
      type: 'application/pdf',
      disposition: 'inline; filename="desprendible.pdf"',
      length: pdf.length,
    });
    expect(headers['Cache-Control']).toBe('private, no-store');
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('%PDF-1.7 contenido');
  });

  it('encodes text documents as UTF-8', () => {
    const { res } = responseStub();
    const file = sendDocument(res, { contentType: 'text/html; charset=utf-8', fileName: 'c.html', body: 'Año' });
    expect(file.getHeaders().length).toBe(Buffer.byteLength('Año'));
  });
});
