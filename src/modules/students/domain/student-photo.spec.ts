import { MAX_PHOTO_BYTES, StudentPhoto } from './student-photo.js';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PHP = new TextEncoder().encode('<?php system($_GET["c"]); ?>');

describe('StudentPhoto', () => {
  it.each([
    ['foto.JPEG', 'image/jpeg', JPEG, 'jpg'],
    ['foto.jpg', 'image/jpeg', JPEG, 'jpg'],
    ['foto.png', 'image/png', PNG, 'png'],
    ['foto.webp', 'image/webp', WEBP, 'webp'],
  ])('accepts %s (%s)', (originalName, mimeType, content, extension) => {
    expect(StudentPhoto.from({ originalName, mimeType, content })).toMatchObject({ mimeType, extension });
  });

  it.each([
    ['shell.php', 'image/jpeg', JPEG],
    ['foto.jpg', 'application/x-php', JPEG],
    ['foto.jpg', 'image/jpeg', PHP],
    ['foto.png', 'image/png', JPEG],
    ['foto.gif', 'image/gif', JPEG],
    ['foto', 'image/jpeg', JPEG],
  ])('rejects %s declared as %s (security S4)', (originalName, mimeType, content) => {
    expect(() => StudentPhoto.from({ originalName, mimeType, content })).toThrow(
      expect.objectContaining({ code: 'INVALID_PHOTO_TYPE' }),
    );
  });

  it('rejects empty and oversized files', () => {
    expect(() =>
      StudentPhoto.from({
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        content: new Uint8Array(),
      }),
    ).toThrow(expect.objectContaining({ code: 'PHOTO_REQUIRED' }));
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set(JPEG);
    expect(() =>
      StudentPhoto.from({
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        content: big,
      }),
    ).toThrow(expect.objectContaining({ code: 'PHOTO_TOO_LARGE' }));
  });

  it('infers the MIME type of stored photos', () => {
    expect(StudentPhoto.mimeTypeFor('students/a.png')).toBe('image/png');
    expect(StudentPhoto.mimeTypeFor('public/uploads/x.bin')).toBe('application/octet-stream');
  });
});
