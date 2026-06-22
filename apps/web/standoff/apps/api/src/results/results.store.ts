import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { DuelResultRecord } from '@standoffduel/shared';
import Redis from 'ioredis';

/** Permalinks are throwaway social artifacts - keep them a month, then expire. */
const TTL_SECONDS = 60 * 60 * 24 * 30;
const key = (id: string) => `result:${id}`;

/**
 * Stores shareable duel results for the `/r/<id>` permalink.
 *
 * Uses Redis when `REDIS_URL` is set (Railway Redis, Upstash, or any
 * `redis(s)://` URL) and falls back to an in-memory map otherwise - so local
 * dev and a single long-lived instance work with zero config, while production
 * gets durability across redeploys by adding one env var.
 */
@Injectable()
export class ResultsStore implements OnModuleDestroy {
  private readonly logger = new Logger(ResultsStore.name);
  private readonly redis: Redis | null;
  private readonly mem = new Map<string, DuelResultRecord>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
      this.redis.on('error', (e) => this.logger.warn(`redis: ${e.message}`));
      this.logger.log('results persistence: redis');
    } else {
      this.redis = null;
      this.logger.log('results persistence: in-memory (set REDIS_URL to persist)');
    }
  }

  async save(record: DuelResultRecord): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(key(record.id), JSON.stringify(record), 'EX', TTL_SECONDS);
        return;
      } catch (e) {
        this.logger.warn(`save fell back to memory: ${(e as Error).message}`);
      }
    }
    this.mem.set(record.id, record);
  }

  async get(id: string): Promise<DuelResultRecord | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key(id));
        return raw ? (JSON.parse(raw) as DuelResultRecord) : null;
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
