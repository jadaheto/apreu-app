import { describeRequestAccess } from './request-access.js';

describe('describeRequestAccess', () => {
  it('derives the module from the first path segment and drops the query string', () => {
    expect(describeRequestAccess({ method: 'get', url: '/api/students/5/ficha?token=x', statusCode: 200 })).toEqual({
      path: 'GET /api/students/5/ficha',
      module: 'students',
      allowed: true,
    });
  });

  it('marks forbidden responses as not allowed', () => {
    expect(describeRequestAccess({ method: 'POST', url: '/api/accounting/periods', statusCode: 403 })).toMatchObject({
      module: 'accounting',
      allowed: false,
    });
    expect(describeRequestAccess({ method: 'POST', url: '/api/accounting/periods', statusCode: 422 })?.allowed).toBe(
      true,
    );
  });

  it.each([
    ['GET', '/health'],
    ['GET', '/api/health'],
    ['GET', '/docs/swagger-ui.css'],
    ['GET', '/api/docs'],
    ['POST', '/api/internal/tenants/a/invalidate'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/auth/logout'],
    ['GET', '/api/assets/app.js'],
    ['OPTIONS', '/api/students'],
    ['HEAD', '/api/students'],
    ['GET', '/api/'],
    ['GET', '/api/notifications'],
    ['GET', '/api/notifications?page=1&limit=10'],
    ['GET', '/api/notifications/'],
    ['GET', '/api/institution/branding'],
  ])('ignores %s %s', (method, url) => {
    expect(describeRequestAccess({ method, url, statusCode: 200 })).toBeNull();
  });

  it.each([
    ['POST', '/api/notifications', 'notifications'],
    ['PATCH', '/api/notifications/read-all', 'notifications'],
    ['GET', '/api/notifications/5', 'notifications'],
    ['PUT', '/api/institution/branding', 'institution'],
    ['GET', '/api/institution', 'institution'],
  ])('still audits %s %s (only the polled reads are skipped)', (method, url) => {
    expect(describeRequestAccess({ method, url, statusCode: 200 })).toMatchObject({ path: `${method} ${url}` });
  });
});
