import { tenantSlugOf } from './tenant.middleware.js';

describe('tenantSlugOf', () => {
  it('prefers the X-Tenant header', () => {
    expect(tenantSlugOf({ headers: { 'x-tenant': 'colegio-a' }, originalUrl: '/api/webhooks/whatsapp/otro' })).toBe(
      'colegio-a',
    );
  });

  it('reads the slug from webhook callback URLs', () => {
    expect(tenantSlugOf({ headers: {}, originalUrl: '/api/webhooks/whatsapp/colegio-b?hub.mode=subscribe' })).toBe(
      'colegio-b',
    );
    expect(tenantSlugOf({ headers: {}, originalUrl: '/api/webhooks/whatsapp/colegio-b' })).toBe('colegio-b');
  });

  it('returns undefined for other routes without header', () => {
    expect(tenantSlugOf({ headers: {}, originalUrl: '/api/students/colegio-b' })).toBeUndefined();
  });
});
