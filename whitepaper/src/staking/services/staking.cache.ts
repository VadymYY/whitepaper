import { config } from "@core/config/config";
import { Injectable } from "@nestjs/common";
import { v4 } from 'uuid';

import { StakingCachePrefix } from "../consts/enum";
import { RedisService } from "../lib/redis";

@Injectable()
export class StakingCache {
  constructor(
    private readonly redisService: RedisService,
  ) { }

  async setLastBlock(block: unknown) {
    this.redisService.set(this.createRedisKey(StakingCachePrefix.LAST_BLOCK), JSON.stringify(block));
  }

  async setValidatorRecentlyProposedBlock(address: string, block: unknown) {
    const key = this.createRedisKey(this.createRedisKey(StakingCachePrefix.VALIDATOR_RECENTLY_PROPOSED_BLOCKS, address), v4());
    this.redisService.setWithTTL(key, JSON.stringify(block), config.cache.validatorRecentlyProposedBlock);
  }

  async setValidatorSignatures(address: string, blocks: unknown) {
    const key = this.createRedisKey(StakingCachePrefix.VALIDATOR_SIGNATURES, address, v4());
    this.redisService.setWithTTL(key, JSON.stringify(blocks), config.cache.validatorSignature);
  }

  async getValidators() {
    return this.getObjectFromRedis(this.createRedisKey(StakingCachePrefix.VALIDATORS));
  }

  async setValidators(validators: unknown[]) {
    const serialized = JSON.stringify(validators);
    await this.redisService.setWithTTL(this.createRedisKey(StakingCachePrefix.VALIDATORS), serialized, config.cache.validators);
  }

  async getValidatorImg(id: string) {
    return this.redisService.get(this.createRedisKey(StakingCachePrefix.VALIDATOR_IMG, id));
  }

  async getGlobalStakedOverview() {
    return this.getObjectFromRedis(this.createRedisKey(StakingCachePrefix.GLOBAL_OVERVIEW));
  }

  async setGlobalStakedOverview(data: unknown) {
    const serialized = JSON.stringify(data);
    await this.redisService.setWithTTL(this.createRedisKey(StakingCachePrefix.GLOBAL_OVERVIEW), serialized, config.cache.globalStakingOverview);
  }

  async getValidatorSignatures(address: string) {
    const pattern = this.createRedisKey(StakingCachePrefix.VALIDATOR_SIGNATURES, address, '*');
    const keys = await this.redisService.keys(pattern);
    const signatures = await Promise.all(keys.map((key: string) => this.redisService.get(key)));

    return signatures.map(signature => JSON.parse(signature!));
  }

  private async getObjectFromRedis<T>(key: string): Promise<T | null> {
    const serialized = await this.redisService.get(key);

    if (!serialized) {
      return null;
    }

    return JSON.parse(serialized as string);
  }

  private createRedisKey(...ids: string[]) {
    return ids.reduce((acc, id) => acc + `_${id}`, `${StakingCachePrefix.STAKING}`);
  }
}
