import { Injectable } from "@nestjs/common";
import { config } from "@core/config/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis(config.redis.port, config.redis.host);
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string) {
    return this.client.set(key, value);
  }

  async setWithTTL(key: string, value: string, ttl: number) {
    return this.client.set(key, value, 'EX', ttl);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}