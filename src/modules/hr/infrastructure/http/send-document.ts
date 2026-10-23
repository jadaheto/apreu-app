import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { RenderedDocument } from '../../application/ports/document-renderer.port.js';

/**
 * Wraps a rendered document for `@Res({ passthrough: true })` handlers.
 *
 * It must be a {@link StreamableFile}: Nest serializes any other object with
 * `res.json()`, so returning the PDF `Buffer` itself sent
 * `{"type":"Buffer","data":[…]}` labelled as `application/pdf` (found by the E2E suite).
 */
export const sendDocument = (res: Response, document: RenderedDocument): StreamableFile => {
  res.setHeader('Cache-Control', 'private, no-store');
  const body = typeof document.body === 'string' ? Buffer.from(document.body, 'utf8') : document.body;
  return new StreamableFile(body, {
    type: document.contentType,
    disposition: `inline; filename="${document.fileName}"`,
    length: body.length,
  });
};
