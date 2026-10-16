import { describe, expect, it } from 'vitest';
import { REDACTED, isSensitiveRoute, redact, sanitizeErrorMessage } from './redaction';

/**
 * Redaction is one of the few controls where a silent regression leaks real
 * harm: a report description or a resident's phone number reaching a log store.
 * These tests assert on the *absence* of known values, not just on the presence
 * of a placeholder, because the failure mode is "logged anyway".
 */

describe('redact', () => {
  it('replaces a secret value regardless of how the key is cased', () => {
    const out = redact({
      password: 'correct horse battery staple',
      PASSWORD: 'correct horse battery staple',
      Password: 'correct horse battery staple',
    }) as Record<string, unknown>;

    for (const value of Object.values(out)) {
      expect(value).toBe(REDACTED);
    }
  });

  it('redacts tokens, secrets and authorization headers', () => {
    const out = redact({
      statusToken: 'abc123',
      refreshToken: 'abc123',
      jwtAccessSecret: 'abc123',
      authorization: 'Bearer abc123',
      cookie: 'acc_access=abc123',
      csrfToken: 'abc123',
    }) as Record<string, unknown>;

    expect(JSON.stringify(out)).not.toContain('abc123');
  });

  it('redacts resident identity and contact details', () => {
    const out = redact({
      reporterName: 'Abebe Kebede',
      reporterPhone: '0912345678',
      reporterEmail: 'resident@example.invalid',
      latitude: 13.49,
      longitude: 39.47,
    }) as Record<string, unknown>;

    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain('Abebe');
    expect(serialised).not.toContain('0912345678');
    expect(serialised).not.toContain('resident@example.invalid');
  });

  it('redacts a free-text report description', () => {
    const description = 'A stranger has been living in our water tank for four days.';
    const out = redact({ description }) as Record<string, unknown>;

    expect(JSON.stringify(out)).not.toContain('water tank');
  });

  it('redacts nested personal data, not just top-level keys', () => {
    const out = redact({
      report: { location: { landmarkDescription: 'behind the blue shop' } },
    }) as Record<string, Record<string, Record<string, Record<string, unknown>>>>;

    expect(JSON.stringify(out)).not.toContain('blue shop');
  });

  it('keeps non-sensitive operational fields readable', () => {
    // Redaction that destroys the log's usefulness gets turned off by whoever
    // is on call, so the safe fields have to survive.
    const out = redact({
      requestId: 'req-123',
      status: 201,
      durationMs: 42.5,
      referenceCode: 'ACC-7F3K9Q2M',
    }) as Record<string, unknown>;

    expect(out.requestId).toBe('req-123');
    expect(out.status).toBe(201);
    expect(out.durationMs).toBe(42.5);
    expect(out.referenceCode).toBe('ACC-7F3K9Q2M');
  });

  it('truncates an unbounded string instead of logging all of it', () => {
    const out = redact({ note: 'x'.repeat(5000) }) as Record<string, string>;

    expect(out.note.length).toBeLessThan(400);
    expect(out.note).toContain('[truncated]');
  });

  it('survives a circular reference without throwing', () => {
    // Logging must never be the thing that takes the process down.
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;

    expect(() => redact(cyclic)).not.toThrow();
  });

  it('serialises an Error without its stack', () => {
    const out = redact(new Error('boom')) as Record<string, unknown>;

    expect(out.message).toBe('boom');
    expect(out).not.toHaveProperty('stack');
  });

  it('passes null and undefined through unchanged', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('stops at a depth a hostile payload cannot exploit', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 40; i += 1) deep = { next: deep };

    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
  });
});

describe('isSensitiveRoute', () => {
  it('treats report and staff routes as sensitive in their entirety', () => {
    for (const url of [
      '/api/v1/reports',
      '/api/v1/reports/ACC-7F3K9Q2M/status',
      '/api/v1/admin/reports',
      '/api/v1/admin/reports/abc/attachments/1',
      '/api/v1/auth/login',
      '/api/v1/admin/users',
      '/api/v1/privacy-requests',
    ]) {
      expect(isSensitiveRoute(url), url).toBe(true);
    }
  });

  it('leaves public content routes loggable', () => {
    for (const url of [
      '/api/v1/contacts',
      '/api/v1/announcements',
      '/api/v1/report-categories',
      '/api/v1/health/ready',
      '/api/v1/support-services',
    ]) {
      expect(isSensitiveRoute(url), url).toBe(false);
    }
  });
});

describe('sanitizeErrorMessage', () => {
  it('removes a database connection string', () => {
    const out = sanitizeErrorMessage(
      'P1000: failed using postgresql://acc:hunter2@db.internal:5432/acc_dev',
    );

    expect(out).not.toContain('hunter2');
    expect(out).toContain('[database connection redacted]');
  });

  it('removes a long opaque token', () => {
    const token = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6';
    const out = sanitizeErrorMessage(`Verification failed for ${token}`);

    expect(out).not.toContain(token);
  });

  it('removes an IPv4 address', () => {
    const out = sanitizeErrorMessage('Connection refused from 192.168.100.42:5432');

    expect(out).not.toContain('192.168.100.42');
  });

  it('leaves an ordinary human-readable message alone', () => {
    const message = 'That report category is not available.';
    expect(sanitizeErrorMessage(message)).toBe(message);
  });
});