import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import * as otplib from 'otplib';
import type { Env } from '../../config/env.schema';

/**
 * TOTP (RFC 6238) for privileged staff accounts.
 *
 * Secrets are encrypted at rest with AES-256-GCM rather than stored as plain
 * base32. A database dump should not hand an attacker a working second factor.
 * The encryption key is derived from `JWT_ACCESS_SECRET`, so a deployment
 * already has to provide a high-entropy secret — no additional key material is
 * invented here, and rotating it invalidates enrolments, which is the correct
 * behaviour anyway.
 */
@Injectable()
export class TotpService {
  constructor(@Inject('ACC_ENV') private readonly env: Env) {}

  generateSecret(): string {
    return otplib.authenticator.generateSecret(20);
  }

  /** Verifies a 6-digit code against an encrypted secret. */
  verify(encryptedSecret: string | null, code: string): boolean {
    if (!encryptedSecret) return false;

    const secret = this.decrypt(encryptedSecret);
    if (!secret) return false;

    try {
      // A single-step window: tolerates ordinary clock drift without accepting
      // a code from several minutes ago.
      return otplib.authenticator.check(code, secret);
    } catch {
      return false;
    }
  }

  /** Used only by the enrolment flow, where the secret is not yet stored. */
  verifySecret(plainSecret: string, code: string): boolean {
    try {
      return otplib.authenticator.check(code, plainSecret);
    } catch {
      return false;
    }
  }

  /**
   * The `otpauth://` URI for rendering as a QR code.
   *
   * The label carries the service name and the account email, which is what
   * authenticator apps show the user to confirm they are scanning the right
   * account — a real defence against QR-code swapping.
   */
  enrolmentUri(secret: string, email: string): string {
    return otplib.authenticator.keyuri(email, 'Adigrat Community Connect', secret);
  }

  encrypt(secret: string): string {
    const key = this.deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decrypt(payload: string): string | null {
    const [version, ivPart, tagPart, dataPart] = payload.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !dataPart) return null;

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.deriveKey(), Buffer.from(ivPart, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64url')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      // Wrong key or tampered ciphertext. Treated as "no usable secret" so the
      // account falls back to the normal login path rather than crashing.
      return null;
    }
  }

  private deriveKey(): Buffer {
    // SHA-256 of the configured secret, truncated to 32 bytes. Adequate here
    // because the input is already a high-entropy 256-bit secret, not a
    // passphrase.
    return createHash('sha256')
      .update(`${this.env.JWT_ACCESS_SECRET}:totp`, 'utf8')
      .digest()
      .subarray(0, 32);
  }
}
