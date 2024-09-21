import { Okp4Service } from "@core/lib/okp4/okp4.service";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Log } from "@core/loggers/log";
import { Event } from "@core/enums/event.enum";
import Big from "big.js";

import { StakingCache } from "./staking.cache";
import {
  BlocksResponse,
  Signature,
  ValidatorsViewDto,
  GlobalStakedOverviewDto,
  Validator
} from "../consts/dtos";
import { toPercents } from "../consts/utils";
import { SignatureViewStatus, ValidatorStatus, ValidatorStatusView } from "../consts/enum";

@Injectable()
export class StakingService implements OnModuleInit {
  constructor(
    private readonly okp4Service: Okp4Service,
    private readonly cache: StakingCache,
    private eventEmitter: EventEmitter2
  ) {}

  async newBlock(res: BlocksResponse) {
    try {
      // Create a map of validator addresses to their public keys
      const mapValidatorAddrToPubkey =
        await this.createValidatorAddrToPubkeyMap();
      const signatureToAddressMap = new Map();

      // Cache the latest block view
      const blockView = this.blockView(res);
      await this.cache.setLastBlock(blockView);

      // Process each signature in the block's last commit
      for (const signature of res.block.last_commit.signatures) {
        const validatorAddress = mapValidatorAddrToPubkey.get(
          signature.validator_address
        );

        if (validatorAddress) {
          const signatureView = this.signatureView(signature, validatorAddress);

          // Check if the signature is from the proposer of the block
          if (
            signature.validator_address === res.block.header.proposer_address
          ) {
            signatureView.status = SignatureViewStatus.PROPOSED;
            const validator = await this.findSingleValidator(validatorAddress);
            const blockWithValidatorInfo = {
              ...blockView,
              img: validator?.logo,
              name: validator?.description.moniker
            }
            // Cache the recently proposed block and emit an event
            await this.cache.setValidatorRecentlyProposedBlock(
              validatorAddress,
              blockWithValidatorInfo
            );
            this.eventEmitter.emit(
              Event.BLOCK_CACHED,
              validatorAddress,
              blockWithValidatorInfo
            );
          }

          // Update the signature to address map and cache the validator's signatures
          signatureToAddressMap.set(validatorAddress, signatureView);
          await this.cache.setValidatorSignatures(
            validatorAddress,
            signatureView
          );
        }
      }

      // Handle validators who missed signing the block
      for (const address of mapValidatorAddrToPubkey.values()) {
        if (!signatureToAddressMap.has(address)) {
          const missedSignatureView = this.missedSignatureView(address);

          // Update the map and cache the missed signature
          signatureToAddressMap.set(address, missedSignatureView);
          await this.cache.setValidatorSignatures(address, missedSignatureView);
        }
      }

      // Emit an event after caching all signatures
      this.eventEmitter.emit(Event.SIGNATURES_CACHED, signatureToAddressMap);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      Log.warn(`New block error: ${e.message}`);
    }
  }

  private blockView(res: BlocksResponse) {
    return {
      height: res.block.last_commit.height,
      blockHash: res.block.last_commit.block_id.hash,
      txs: String(res.block.data.txs.length),
      time: new Date(),
    };
  }

  private missedSignatureView(addr: string) {
    return {
      status: SignatureViewStatus.MISSED,
      address: addr,
      timestamp: "",
      signature: "",
    };
  }

  private signatureView(signature: Signature, address: string) {
    return {
      status: SignatureViewStatus.SIGNED,
      address,
      timestamp: signature.timestamp,
      signature: signature.signature,
    };
  }

  private async createValidatorAddrToPubkeyMap() {
    const map = new Map();
    await this.fetchAndCacheValidators();
    const validators = await this.cache.getValidators() as Validator[];

    if(!validators) {
      Log.warn('Validators list empty');
    }

    for (const validator of validators) {
      const pubkey = this.okp4Service
        .wssPubkeyToAddr(validator.consensus_pubkey.key)
        .toUpperCase();
      map.set(pubkey, validator.operator_address);
    }

    return map;
  }

  private async findSingleValidator(address: string) {
    const validators: ValidatorsViewDto[] = await this.getValidators();
    return validators.find(
      (validator) => validator.address === address
    );
  }

  async getValidators() {
    const cache = await this.cache.getValidators() as Validator[];

    if (cache === null) {
      return this.fetchAndCacheValidators();
    }

    return this.validatorsView(cache);
  }

  private async fetchAndCacheValidators() {
    const { validators } = await this.okp4Service.getValidators();
    await this.cache.setValidators(validators);

    return this.validatorsView(validators);
  }

  private async validatorsView(
    toView: Validator[]
  ): Promise<ValidatorsViewDto[]> {
    const view = [];
    const globalOverview: GlobalStakedOverviewDto = await this.getGlobalOverview();

    for (const validator of toView) {
      const uptime = await this.calculateValidatorUptime(validator.operator_address);
      const votingPower = Big(validator.delegator_shares).div(globalOverview.totalStaked).toNumber();
      const logo = (await this.cache.getValidatorImg(validator.description.identity)) as string;

      view.push({
        logo,
        description: {
          moniker: validator.description.moniker,
          details: validator.description.details,
          securityContact: validator.description.security_contact,
          identity: validator.description.identity,
          website: validator.description.website,
        },
        address: validator.operator_address,
        status:
          validator.status === ValidatorStatus.BONDED
            ? ValidatorStatusView.BONDED
            : ValidatorStatusView.UN_BONDED,
        jailed: validator.jailed,
        stakedAmount: validator.delegator_shares,
        uptime: toPercents(uptime),
        votingPower: toPercents(votingPower),
        commission: {
          updateTime: validator.commission.update_time,
          rate: toPercents(validator.commission.commission_rates.rate),
          maxChangeRate: toPercents(validator.commission.commission_rates.max_change_rate),
          maxRate: toPercents(validator.commission.commission_rates.max_rate),
        },
      });
    }

    return view;
  }

  async getGlobalOverview() {
    const cache = await this.cache.getGlobalStakedOverview() as GlobalStakedOverviewDto;

    if (cache === null) {
      return this.fetchAndCacheGlobalStakedOverview();
    }

    return cache;
  }

  private async fetchAndCacheGlobalStakedOverview(): Promise<GlobalStakedOverviewDto> {
    const rez = await Promise.all([
      this.okp4Service.getBondValidators(),
      this.okp4Service.getApr(),
      this.fetchTotalSupply(),
      this.okp4Service.getStakingPool(),
    ]);

    const totalStaked = this.calculateTotalStaked(rez[0].validators);

    const dto: GlobalStakedOverviewDto = {
      totalValidators: rez[0].pagination.total,
      apr: rez[1],
      totalStaked,
      bondedTokens: toPercents(Big(rez[3].pool.bonded_tokens).div(rez[2]!.amount)),
    };

    await this.cache.setGlobalStakedOverview(dto);

    return dto;
  }

  private async fetchTotalSupply() {
    const res = await this.okp4Service.getTotalSupply();
    return res.supply.find(({ denom }) => denom === config.app.tokenDenom);
  }

  private calculateTotalStaked(validators: Validator[]): string {
    const totalStaked = validators.reduce(
      (acc, val) => acc.add(val.delegator_shares),
      Big(0)
    );
    return totalStaked.toString();
  }

  private async calculateValidatorUptime(address: string) {
    const blocks: Signature[] = await this.cache.getValidatorSignatures(
      address
    );
    const signed = blocks.reduce((acc, block) => {
      if (block && block.signature) {
        acc += 1;
      }
      return acc;
    }, 0);
    if (!blocks?.length || !signed) {
      return 0;
    }
    return Big(blocks.length).div(signed).toNumber();
  }
}
