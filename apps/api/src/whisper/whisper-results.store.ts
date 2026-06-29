import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { WhisperResultRecord } from '@shadyexperiments/shared';
import Redis from 'ioredis';

/** Permalinks are throwaway social artifacts - keep them a month, then expire. */
const TTL_SECONDS = 60 * 60 * 24 * 30;
const key = (id: string) => `wh:${id}`;

/**
 * Stores shareable Whispering Hacker run results for the permalink. Mirrors
 * Standoff's `ResultsStore` (Redis when `REDIS_URL` is set, in-memory otherwise)
 * but with its own `wh:` key namespace so the two experiments never collide.
 */
@Injectable()
export class WhisperResultsStore implements OnModuleDestroy {
  private readonly logger = new Logger(WhisperResultsStore.name);
  private readonly redis: Redis | null;
  private readonly mem = new Map<string, WhisperResultRecord>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
      this.redis.on('error', (e) => this.logger.warn(`redis: ${e.message}`));
      this.logger.log('whisper results persistence: redis');
    } else {
      this.redis = null;
      this.logger.log(
        'whisper results persistence: in-memory (set REDIS_URL to persist)',
      );
    }
  }

  async save(record: WhisperResultRecord): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(
          key(record.id),
          JSON.stringify(record),
          'EX',
          TTL_SECONDS,
        );
        return;
      } catch (e) {
        this.logger.warn(`save fell back to memory: ${(e as Error).message}`);
      }
    }
    this.mem.set(record.id, record);
  }

  async get(id: string): Promise<WhisperResultRecord | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key(id));
        return raw ? (JSON.parse(raw) as WhisperResultRecord) : null;
      } catch (e) {
        this.logger.warn(`get fell back to memory: ${(e as Error).message}`);
      }
    }
    return this.mem.get(id) ?? null;
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }
}
