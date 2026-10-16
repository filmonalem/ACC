import * as argon2 from 'argon2';
import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.schema';

/**
 * Password and token hashing.
 *
 * Passwords use Argon2id, the memory-hard winner recommended by current OWASP
 * guidance. Parameters come from configuration with OWASP's baseline (19 MiB,
 * t=2, p=1) as the default, so a deployment can raise the cost without a code
 * change.
 *
 * Opaque tokens (refresh tokens, password-reset tokens) are deliberately *not*
 * Argon2-hashed: they are 256-bit random values, so there is nothing to brute
 * force and SHA-256 is the correct, far cheaper choice. Hashing everything with
 * one function is a common and expensive mistake — it turns a per-request
 * verification into hundreds of milliseconds of memory-hard work.
 */
@Injectable()
export class PasswordService {
  constructor(@Inject('ACC_ENV') private readonly env: Env) {}

  /** Returns a PHC-format Argon2id hash. */
  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: this.env.ARGON2_MEMORY_COST,
      timeCost: this.env.ARGON2_TIME_COST,
      parallelism: this.env.ARGON2_PARALLELISM,
    });
  }

  /**
   * Verifies a password.
   *
   * Returns false rather than throwing on a malformed stored hash, so a
   * corrupted row cannot become a 500 that distinguishes that account from
   * others.
   */
  async verifyPassword(hash: string | null, plain: string): Promise<boolean> {
    if (!hash) {
      // Still spend the time. Without this, "no password set" responds
      // measurably faster than "wrong password" — an account-existence oracle.
      await this.hashPassword(plain);
      return false;
    }
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** 32 bytes ≈ 256 bits of entropy. */
  createToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
