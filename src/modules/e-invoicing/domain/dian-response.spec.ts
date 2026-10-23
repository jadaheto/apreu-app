import { interpretDianResponse } from './dian-response.js';
import { dianResponse } from '../testing/fixtures.js';

describe('interpretDianResponse', () => {
  it('accepts 00 + IsValid', () => {
    expect(interpretDianResponse(dianResponse())).toEqual({ outcome: 'accepted', errors: [], notices: [] });
  });

  it('separates notification rules from rejections', () => {
    const accepted = interpretDianResponse(
      dianResponse({ messages: ['Regla: FAK26, Notificación: Nombre no coincide con el RUT'] }),
    );
    expect(accepted.outcome).toBe('accepted_with_notices');
    expect(accepted.notices).toHaveLength(1);

    const rejected = interpretDianResponse(
      dianResponse({
        statusCode: '99',
        isValid: false,
        messages: [
          'Regla: FAD06, Rechazo: Valor del CUFE no está calculado correctamente.',
          'Regla: RUT01, Notificación: x',
        ],
      }),
    );
    expect(rejected).toEqual({
      outcome: 'rejected',
      errors: ['Regla: FAD06, Rechazo: Valor del CUFE no está calculado correctamente.'],
      notices: ['Regla: RUT01, Notificación: x'],
    });
  });

  it.each(['66', '90'])('keeps code %s as processing (legacy marked it rejected)', (statusCode) => {
    expect(interpretDianResponse(dianResponse({ statusCode, isValid: false })).outcome).toBe('processing');
  });

  it('treats an async receipt and "en proceso" answers as processing', () => {
    expect(
      interpretDianResponse(
        dianResponse({
          statusCode: null,
          isValid: null,
          trackId: 'zip',
          applicationResponse: null,
          applicationResponseCode: null,
        }),
      ).outcome,
    ).toBe('processing');
    expect(
      interpretDianResponse(
        dianResponse({
          statusCode: null,
          isValid: false,
          statusDescription: 'Batch en proceso de validación.',
          applicationResponseCode: null,
        }),
      ).outcome,
    ).toBe('processing');
  });

  it('uses the ApplicationResponse code when the web service has no status', () => {
    expect(
      interpretDianResponse(dianResponse({ statusCode: null, isValid: null, applicationResponseCode: '04' })).outcome,
    ).toBe('rejected');
    expect(
      interpretDianResponse(dianResponse({ statusCode: null, isValid: null, applicationResponseCode: '02' })).outcome,
    ).toBe('accepted');
  });

  it('gives a generic reason when a rejection has no messages', () => {
    expect(
      interpretDianResponse(
        dianResponse({ statusCode: '99', isValid: false, statusDescription: 'Validación contiene errores' }),
      ).errors,
    ).toEqual(['Validación contiene errores']);
  });
});
