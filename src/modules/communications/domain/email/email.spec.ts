import { Audience, MAX_MANUAL_EMAILS } from './audience.js';
import { MAX_ATTACHMENT_BYTES, safeFileName, toEmailAttachments } from './email-attachment.js';
import { EMAIL_PREVIEW_LENGTH, EmailLog } from './email-log.js';
import { uniqueValidRecipients } from './recipient.js';
import { PDF_BYTES, PNG_BYTES } from '../../testing/fakes.js';

describe('Audience', () => {
  it('requires the target of grade and classroom audiences', () => {
    expect(Audience.create({ kind: 'by_grade', gradeId: 3 }).gradeId).toBe(3);
    expect(Audience.create({ kind: 'by_classroom', classroomId: 7 }).classroomId).toBe(7);
    expect(() => Audience.create({ kind: 'by_grade' })).toThrow(
      expect.objectContaining({ code: 'AUDIENCE_TARGET_REQUIRED' }),
    );
    expect(() => Audience.create({ kind: 'by_classroom', classroomId: 0 })).toThrow(
      expect.objectContaining({ code: 'AUDIENCE_TARGET_REQUIRED' }),
    );
  });

  it('ignores targets that do not apply to the kind', () => {
    const audience = Audience.create({ kind: 'all_parents', gradeId: 3, classroomId: 4 });
    expect(audience).toMatchObject({ gradeId: null, classroomId: null, manualEmails: [] });
  });

  it('splits manual lists by comma, semicolon or new line', () => {
    const audience = Audience.create({ kind: 'manual', manualEmails: 'a@x.co, b@x.co;\nc@x.co,,' });
    expect(audience.manualEmails).toEqual(['a@x.co', 'b@x.co', 'c@x.co']);
    expect(() => Audience.create({ kind: 'manual', manualEmails: ' , ' })).toThrow(
      expect.objectContaining({ code: 'EMPTY_MANUAL_LIST' }),
    );
    const tooMany = Array.from({ length: MAX_MANUAL_EMAILS + 1 }, (_, i) => `u${i}@x.co`);
    expect(() => Audience.create({ kind: 'manual', manualEmails: tooMany })).toThrow(
      expect.objectContaining({ code: 'MANUAL_LIST_TOO_LONG' }),
    );
  });

  it('rejects unknown kinds', () => {
    expect(() => Audience.create({ kind: 'todos' as never })).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
  });
});

describe('uniqueValidRecipients', () => {
  it('normalizes, drops invalid addresses and de-duplicates by e-mail', () => {
    const result = uniqueValidRecipients([
      { email: ' Ana@Mail.co ', name: ' Ana ' },
      { email: 'ana@mail.co', name: 'Otra' },
      { email: 'no-es-correo', name: 'X' },
      { email: 'luis@mail.co', name: '' },
    ]);
    expect(result).toEqual([
      { email: 'ana@mail.co', name: 'Ana' },
      { email: 'luis@mail.co', name: null },
    ]);
  });
});

describe('toEmailAttachments', () => {
  const file = (originalName: string, content: Buffer, size = content.length) => ({ originalName, content, size });

  it('accepts allowed files whose content matches the extension', () => {
    const [pdf, png] = toEmailAttachments([file('circular.pdf', PDF_BYTES), file('foto.PNG', PNG_BYTES)]);
    expect(pdf).toMatchObject({ filename: 'circular.pdf', contentType: 'application/pdf' });
    expect(png.contentType).toBe('image/png');
  });

  it('enforces count, size and type on the server (legacy bug #7)', () => {
    const six = Array.from({ length: 6 }, (_, i) => file(`a${i}.pdf`, PDF_BYTES));
    expect(() => toEmailAttachments(six)).toThrow(expect.objectContaining({ code: 'TOO_MANY_ATTACHMENTS' }));
    expect(() => toEmailAttachments([file('big.pdf', PDF_BYTES, MAX_ATTACHMENT_BYTES + 1)])).toThrow(
      expect.objectContaining({ code: 'ATTACHMENT_TOO_LARGE' }),
    );
    expect(() => toEmailAttachments([file('shell.php', Buffer.from('<?php'))])).toThrow(
      expect.objectContaining({ code: 'ATTACHMENT_TYPE_NOT_ALLOWED' }),
    );
    expect(() => toEmailAttachments([file('fake.pdf', PNG_BYTES)])).toThrow(
      expect.objectContaining({ code: 'ATTACHMENT_TYPE_NOT_ALLOWED' }),
    );
  });

  it('sanitizes file names', () => {
    expect(safeFileName('../../etc/Información "final".pdf')).toBe('Informacion _final_.pdf');
    expect(safeFileName('C:\\temp\\x\r\ny.pdf')).toBe('x__y.pdf');
    expect(safeFileName('...')).toBe('archivo');
  });
});

describe('EmailLog', () => {
  const at = new Date('2026-03-15T10:00:00Z');
  const input = {
    toEmail: 'p@x.co',
    toName: 'Padre',
    subject: 'Reunión',
    body: `<p>${'texto '.repeat(100)}</p>`,
    type: 'aviso' as const,
    createdBy: 1,
  };

  it('records successful deliveries with a 200 character plain-text preview', () => {
    const log = EmailLog.sent(input, at);
    expect(log).toMatchObject({ status: 'sent', errorMessage: null, createdAt: at, type: 'aviso' });
    expect(log.bodyPreview).toHaveLength(EMAIL_PREVIEW_LENGTH);
    expect(log.bodyPreview).not.toContain('<p>');
  });

  it('records failures with the error of that attempt', () => {
    expect(EmailLog.failed(input, 'buzón lleno', at)).toMatchObject({ status: 'failed', errorMessage: 'buzón lleno' });
    expect(EmailLog.failed(input, '', at).errorMessage).toBe('Error desconocido');
  });

  it('validates recipient and type', () => {
    expect(() => EmailLog.sent({ ...input, toEmail: ' ' }, at)).toThrow(
      expect.objectContaining({ code: 'REQUIRED_FIELD' }),
    );
    expect(() => EmailLog.sent({ ...input, type: 'spam' as never }, at)).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
  });
});
