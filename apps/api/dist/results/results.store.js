"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ResultsStore_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultsStore = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
/** Permalinks are throwaway social artifacts - keep them a month, then expire. */
const TTL_SECONDS = 60 * 60 * 24 * 30;
const key = (id) => `result:${id}`;
/**
 * Stores shareable duel results for the `/r/<id>` permalink.
 *
 * Uses Redis when `REDIS_URL` is set (Railway Redis, Upstash, or any
 * `redis(s)://` URL) and falls back to an in-memory map otherwise - so local
 * dev and a single long-lived instance work with zero config, while production
 * gets durability across redeploys by adding one env var.
 */
let ResultsStore = ResultsStore_1 = class ResultsStore {
    constructor() {
        this.logger = new common_1.Logger(ResultsStore_1.name);
        this.mem = new Map();
        const url = process.env.REDIS_URL;
        if (url) {
            this.redis = new ioredis_1.default(url, { maxRetriesPerRequest: 2 });
            this.redis.on('error', (e) => this.logger.warn(`redis: ${e.message}`));
            this.logger.log('results persistence: redis');
        }
        else {
            this.redis = null;
            this.logger.log('results persistence: in-memory (set REDIS_URL to persist)');
        }
    }
    async save(record) {
        if (this.redis) {
            try {
                await this.redis.set(key(record.id), JSON.stringify(record), 'EX', TTL_SECONDS);
                return;
            }
            catch (e) {
                this.logger.warn(`save fell back to memory: ${e.message}`);
            }
        }
        this.mem.set(record.id, record);
    }
    async get(id) {
        if (this.redis) {
            try {
                const raw = await this.redis.get(key(id));
                return raw ? JSON.parse(raw) : null;
            }
            catch (e) {
                this.logger.warn(`get fell back to memory: ${e.message}`);
            }
        }
        return this.mem.get(id) ?? null;
    }
    onModuleDestroy() {
        this.redis?.disconnect();
    }
};
exports.ResultsStore = ResultsStore;
exports.ResultsStore = ResultsStore = ResultsStore_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ResultsStore);
//# sourceMappingURL=results.store.js.map