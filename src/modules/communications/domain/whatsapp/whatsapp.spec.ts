import { PhoneNumber } from './phone-number.js';
import { WhatsAppLog } from './whatsapp-log.js';
import { templateData } from '../../testing/fixtures.js';
import { WhatsAppTemplate } from './whatsapp-template.js';

describe('PhoneNumber', () => {
  it.each([
    ['300 123 4567', '573001234567'],
    ['+57 (300) 123-4567', '573001234567'],
    ['573001234567', '573001234567'],
    ['0057 300 123 4567', '573001234567'],
    ['+1 415 555 2671', '14155552671'],
  ])('normalizes %s (RN-COM-11)', (raw, digits) => {
    const phone = PhoneNumber.create(raw);
    expect(phone.digits).toBe(digits);
    expect(phone.e164).toBe(`+${digits}`);
  });

  it.each(['12345', '57300123', '5730012345678', '', 'abc'])('rejects %s', (raw) => {
    expect(() => PhoneNumber.create(raw)).toThrow(expect.objectContaining({ code: 'INVALID_PHONE' }));
  });
});

describe('WhatsAppTemplate', () => {
  it('creates a valid template and counts placeholders', () => {
    const template = WhatsAppTemplate.create(templateData({ body: 'Hola {{1}}, {{2}} y otra vez {{1}}' }));
    expect(template.placeholderCount).toBe(2);
    expect(template.isActive).toBe(true);
  });

  it.each([
    [{ name: 'Cobro Mensual' }, 'INVALID_TEMPLATE_NAME'],
    [{ language: 'español' }, 'INVALID_LANGUAGE'],
    [{ body: '' }, 'REQUIRED_FIELD'],
    [{ body: 'x'.repeat(1025) }, 'MAX_LENGTH'],
    [{ body: 'Hola {{1}} {{3}}', variables: ['a', 'b'] }, 'INVALID_PLACEHOLDERS'],
    [{ variables: ['solo-una'] }, 'TEMPLATE_VARIABLES_MISMATCH'],
    [{ headerType: 'text' as const, headerText: '' }, 'REQUIRED_FIELD'],
    [{ headerType: 'image' as const, headerImageUrl: 'http://inseguro.co/a.png' }, 'INVALID_HEADER_IMAGE'],
    [{ footerText: 'x'.repeat(61) }, 'MAX_LENGTH'],
    [{ buttons: Array.from({ length: 11 }, () => ({ type: 'QUICK_REPLY' })) }, 'INVALID_BUTTONS'],
    [{ category: 'otra' as never }, 'INVALID_OPTION'],
  ])('rejects %o', (override, code) => {
    expect(() => WhatsAppTemplate.create(templateData(override))).toThrow(expect.objectContaining({ code }));
  });

  it('composes messages in the template language with an image header (legacy bug #10)', () => {
    const template = WhatsAppTemplate.create(
      templateData({ headerType: 'image', headerImageUrl: 'https://cdn.co/h.png', language: 'es_CO' }),
    );
    expect(template.compose(['Ana\nMaría', ' $10 '])).toEqual({
      name: 'cobro_mensual',
      language: 'es_CO',
      bodyParameters: ['Ana María', '$10'],
      headerImageUrl: 'https://cdn.co/h.png',
    });
  });

  it('requires one non-empty value per placeholder and an active template', () => {
    const template = WhatsAppTemplate.create(templateData());
    expect(() => template.compose(['Ana'])).toThrow(expect.objectContaining({ code: 'TEMPLATE_VARIABLES_MISMATCH' }));
    expect(() => template.compose(['Ana', ' '])).toThrow(
      expect.objectContaining({ code: 'TEMPLATE_VARIABLES_MISMATCH' }),
    );
    template.update(templateData({ status: 'pending' }));
    expect(() => template.compose(['Ana', '$1'])).toThrow(expect.objectContaining({ code: 'TEMPLATE_NOT_ACTIVE' }));
  });

  it('renders previews and updates enforcing the rules', () => {
    const template = WhatsAppTemplate.create(templateData());
    expect(template.render(['Ana'])).toBe('Hola Ana, debe {{2}}.');
    expect(() => template.update(templateData({ name: 'MAL' }))).toThrow();
    template.update(templateData({ footerText: ' Gracias ', headerType: 'text', headerText: 'Cobro' }));
    expect(template).toMatchObject({ footerText: 'Gracias', headerText: 'Cobro', headerImageUrl: null });
  });
});

describe('WhatsAppLog', () => {
  const entry = { studentId: 4, templateName: 'cobro_mensual', phone: '573001234567', createdBy: 1 };
  const at = new Date('2026-03-15T10:00:00Z');

  it('records sent and failed attempts', () => {
    expect(WhatsAppLog.sent(entry, 'wamid.1', at)).toMatchObject({ status: 'sent', waMessageId: 'wamid.1' });
    expect(WhatsAppLog.failed(entry, 'sin saldo', at)).toMatchObject({ status: 'failed', response: 'sin saldo' });
  });

  it('only moves forward with delivery receipts', () => {
    const log = WhatsAppLog.sent(entry, 'wamid.1', at);
    expect(log.applyReceipt('read')).toBe(true);
    expect(log.applyReceipt('delivered')).toBe(false);
    expect(log.status).toBe('read');
    expect(log.applyReceipt('sent')).toBe(false);
  });

  it('treats failed as final', () => {
    const log = WhatsAppLog.sent(entry, 'wamid.1', at);
    expect(log.applyReceipt('failed', 'Usuario bloqueó el número')).toBe(true);
    expect(log.response).toBe('Usuario bloqueó el número');
    expect(log.applyReceipt('delivered')).toBe(false);
    expect(log.status).toBe('failed');
  });
});
