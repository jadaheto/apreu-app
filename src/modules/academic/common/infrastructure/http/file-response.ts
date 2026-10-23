import { StreamableFile } from '@nestjs/common';

/** Binary download built from an application-layer file. */
export const toFileResponse = (file: { fileName: string; contentType: string; content: Uint8Array }): StreamableFile =>
  new StreamableFile(Buffer.from(file.content), {
    type: file.contentType,
    disposition: `attachment; filename="${file.fileName}"`,
    length: file.content.byteLength,
  });
