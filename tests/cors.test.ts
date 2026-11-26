import { describe, expect, it } from 'vitest';
import { allowedCorsOrigins, DEFAULT_CORS_ORIGINS, isAllowedCorsOrigin } from '../src/server/cors.ts';

describe('CORS origins', () => {
  it('includes the huydinh.app and Render hosts by default', () => {
    const allowed = allowedCorsOrigins({});
    for (const origin of DEFAULT_CORS_ORIGINS) {
      expect(allowed.has(origin)).toBe(true);
    }
  });

  it('merges comma-separated CORS_ORIGINS and ignores trailing slashes', () => {
    const allowed = allowedCorsOrigins({
      CORS_ORIGINS: 'https://tienlen-api.huydinh.app/, https://example.com',
    });
    expect(allowed.has('https://tienlen-api.huydinh.app')).toBe(true);
    expect(allowed.has('https://example.com')).toBe(true);
    expect(allowed.has('https://huydinh.app')).toBe(true);
  });

  it('allows requests with no Origin and rejects unknown origins', () => {
    const allowed = allowedCorsOrigins({});
    expect(isAllowedCorsOrigin(undefined, allowed)).toBe(true);
    expect(isAllowedCorsOrigin('https://huydinh.app', allowed)).toBe(true);
    expect(isAllowedCorsOrigin('https://evil.example', allowed)).toBe(false);
  });
});
