import { jpegImage, pngImage, webpImage } from '../testing/image-fixtures.js';
import { detectImageFormat, LOGO_MAX_BYTES, validateImageUpload } from './image-upload.js';

describe('validateImageUpload', () => {
  it.each([
    ['png', pngImage(200, 100), 'image/png', { width: 200, height: 100 }],
    ['jpg', jpegImage(300, 150), 'image/jpeg', { width: 300, height: 150 }],
    ['webp', webpImage(64, 32), 'image/webp', { width: 64, height: 32 }],
  ])('accepts %s detected from its bytes', (extension, content, mime, size) => {
    expect(validateImageUpload({ content, declaredMimeType: mime })).toEqual({ extension, mimeType: mime, ...size });
  });

  it('ignores a missing declared type but rejects a mismatching one', () => {
    expect(validateImageUpload({ content: pngImage() }).extension).toBe('png');
    expect(() => validateImageUpload({ content: pngImage(), declaredMimeType: 'image/jpeg' })).toThrow(
      expect.objectContaining({ code: 'MIME_MISMATCH' }),
    );
  });

  it.each([
    ['empty file', new Uint8Array(), 'EMPTY_FILE'],
    ['oversized file', new Uint8Array(LOGO_MAX_BYTES + 1).fill(1), 'FILE_TOO_LARGE'],
    ['svg', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'UNSUPPORTED_IMAGE'],
    ['php disguised as image', new TextEncoder().encode('<?php system($_GET["c"]); ?>'), 'UNSUPPORTED_IMAGE'],
    ['gif', new TextEncoder().encode('GIF89a......'), 'UNSUPPORTED_IMAGE'],
    ['polyglot png', pngImage(200, 100, '<?php echo 1; ?>'), 'SUSPICIOUS_CONTENT'],
    ['tiny image', pngImage(8, 8), 'INVALID_IMAGE_SIZE'],
    ['huge image', pngImage(5000, 100), 'INVALID_IMAGE_SIZE'],
    ['truncated png', pngImage().subarray(0, 12), 'INVALID_IMAGE'],
    ['jpeg without frame', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0x00, 0x00, 0, 0]), 'INVALID_IMAGE'],
  ])('rejects %s', (_case, content, code) => {
    expect(() => validateImageUpload({ content })).toThrow(expect.objectContaining({ code }));
  });

  it('detects formats only from signatures', () => {
    expect(detectImageFormat(new TextEncoder().encode('hello'))).toBeNull();
  });
});
