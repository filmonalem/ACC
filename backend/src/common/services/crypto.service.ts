import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../config/env.schema';

/**
 * Injectable wrapper so every component gets the same primitives.
 *
 * The ID-generation helpers use a Crockford-style alphabet: no I, L, O or U, so
 * a code read aloud on a phone call or copied off a printed slip cannot be
 * mistranscribed into a different valid code.
 */
@Injectable()
export class CryptoService {
  private static readonly CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  constructor(@Inject('ACC_ENV') private readonly env: Env) {}

  /** URL-safe token, e.g. for CSRF. */
  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /**
   * A resident-facing status token. 32 bytes ≈ 256 bits: enough that a
   * reference code found on a lost phone reveals nothing on its own.
   */
  statusToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** SHA-256 hex. Used for token hashes, request fingerprints, IP hashes. */
  sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /**
   * Salted hash of an IP address, for consent records and audit-adjacent
   * metadata. Raw addresses are never stored alongside a report.
   */
  hashWithPepper(value: string): string {
    return createHash('sha256')
      .update(`${this.env.JWT_ACCESS_SECRET}:${value}`, 'utf8')
      .digest('hex');
  }

  /**
   * Human-facing reference code, e.g. `ACC-7F3K9Q2M`.
   *
   * 8 symbols from a 31-character alphabet is ~40 bits. Combined with the
   * mandatory status token this is sufficient, and the codes stay short enough
   * to read down a phone line.
   */
  referenceCode(): string {
    const alphabet = CryptoService.CODE_ALPHABET;
    const bytes = randomBytes(8);
    let out = '';
    for (let i = 0; i < 8; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return `ACC-${out}`;
  }

  /** Constant-time comparison for anything secret-derived. */
  timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  // ── CSRF ──────────────────────────────────────────────────────────────────

  /**
   * Issues a double-submit CSRF token: `<random>.<hmac>`.
   *
   * Lives here rather than in CsrfGuard so that issuing and verifying are two
   * methods of the same object, using one secret, and cannot drift apart.
   * `common/services/crypto.service.spec.ts` asserts a token this issues is
   * accepted by the same logic the guard runs.
   */
  issueCsrfToken(): string {
    const payload = randomBytes(16).toString('base64url');
    return `${payload}.${this.signCsrfPayload(payload)}`;
  }

  verifyCsrfToken(token: string): boolean {
    const separator = token.lastIndexOf('.');
    if (separator <= 0) return false;

    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    const expected = this.signCsrfPayload(payload);

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    return (
      expectedBuf.length === signatureBuf.length && timingSafeEqual(expectedBuf, signatureBuf)
    );
  }

  private signCsrfPayload(payload: string): string {
    return createHash('sha256')
      .update(`${this.env.JWT_ACCESS_SECRET}:csrf:${payload}`, 'utf8')
      .digest('base64url');
  }
}
