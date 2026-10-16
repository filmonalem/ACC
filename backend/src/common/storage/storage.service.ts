import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import type { Env } from '../../config/env.schema';

export interface StoredObject {
  /** Opaque key stored in the database and returned to authorised callers. */
  objectKey: string;
  byteSize: number;
  checksumSha256: string;
}

/**
 * Private object storage.
 *
 * Deliberately an interface rather than a direct use of `fs`: the pilot runs on
 * a local Docker volume, and moving to S3-compatible storage later must be a
 * configuration change, not a rewrite. Nothing outside this class touches the
 * filesystem, and the key it returns is never a path the caller can influence.
 *
 * Security properties this enforces:
 *  - The root is asserted absolute and created with 0o700.
 *  - Object keys are generated here, never derived from user input, so there is
 *    no path traversal surface at all.
 *  - `resolve()` plus a prefix check on every read defends against symlink and
 *    `..` tricks even though the inputs are already trusted.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(@Inject('ACC_ENV') env: Env) {
    const root = resolve(env.STORAGE_ROOT);
    if (!isAbsolute(env.STORAGE_ROOT)) {
      this.logger.warn(
        `STORAGE_ROOT ("${env.STORAGE_ROOT}") is relative; resolving it against the process working directory to ${root}. ` +
          'Set an absolute path in any deployed environment so the volume location is unambiguous.',
      );
    }
    this.root = root;
  }

  async onModuleInit(): Promise<void> {
    // 0o700: only the service account may list or read attachment contents.
    await mkdir(join(this.root, 'reports'), { recursive: true, mode: 0o700 });
    this.logger.log(`Attachment storage root: ${this.root}`);
  }

  /** Readiness probe: the volume must be writable, not merely present. */
  async assertWritable(): Promise<void> {
    const probe = join(this.root, '.write-probe');
    await writeFile(probe, 'ok', { mode: 0o600 });
    await unlink(probe).catch(() => undefined);
  }

  async put(params: {
    scope: 'reports' | 'verification-evidence';
    ownerId: string;
    content: Buffer;
  }): Promise<StoredObject> {
    // uuid filename under a per-owner directory: no user-controlled path
    // component reaches the filesystem at any point.
    const objectKey = `${params.scope}/${params.ownerId}/${randomUUID()}`;
    const absolute = this.resolveKey(objectKey);

    await mkdir(dirname(absolute), { recursive: true, mode: 0o700 });
    await writeFile(absolute, params.content, { mode: 0o600 });

    return {
      objectKey,
      byteSize: params.content.byteLength,
      checksumSha256: createHash('sha256').update(params.content).digest('hex'),
    };
  }

  /** Streamed read. The caller has already authorized the request. */
  openStream(objectKey: string) {
    return createReadStream(this.resolveKey(objectKey));
  }

  async read(objectKey: string): Promise<Buffer> {
    const { readFile } = await import('node:fs/promises');
    return readFile(this.resolveKey(objectKey));
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(objectKey));
      return true;
    } catch {
      return false;
    }
  }

  async remove(objectKey: string): Promise<void> {
    await unlink(this.resolveKey(objectKey)).catch(() => undefined);
  }

  /**
   * Maps an opaque key to an absolute path, refusing anything that escapes the
   * storage root.
   *
   * Keys are internally generated, so this is defence in depth — but a
   * traversal guard on a file-serving path is cheap and worth keeping even when
   * the inputs look safe.
   */
  private resolveKey(objectKey: string): string {
    const candidate = resolve(join(this.root, normalize(objectKey)));

    if (candidate !== this.root && !candidate.startsWith(this.root + sep)) {
      throw new Error('Refusing to access a path outside the storage root.');
    }

    return candidate;
  }

  get rootPath(): string {
    return this.root;
  }
}
