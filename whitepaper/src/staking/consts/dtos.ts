export interface BlocksResponse {
    block: {
      header: {
        proposer_address: string;
      }
      data: {
        txs: unknown[],
      },
      last_commit: {
        height: string;
        round: number;
        block_id: {
          hash: string;
          part_set_header: {
            total: number;
            hash: string
          }
        };
        signatures: Signature[];
      }
    }
  }
  
export interface Signature {
    block_id_flag: string;
    validator_address: string;
    timestamp: string;
    signature: string;
}

export interface ValidatorsViewDto {
    logo: string;
    description: {
      moniker: string;
      identity: string;
      website: string;
      securityContact: string;
      details: string;
    };
    commission: {
      rate: string;
      maxRate: string;
      maxChangeRate: string;
      updateTime: string;
    };
    address: string;
    status: string;
    jailed: boolean;
    stakedAmount: string;
    uptime: string;
    votingPower: string;
}

export interface GlobalStakedOverviewDto {
  totalValidators: string;
  apr: string;
  totalStaked: string;
  bondedTokens: string;
}

export interface Validator {
  operator_address: string;
  consensus_pubkey: {
    '@type': string;
    key: string;
  };
  jailed: boolean;
  status: string;
  tokens: string;
  delegator_shares: string;
  description: {
    moniker: string;
    identity: string;
    website: string;
    security_contact: string;
    details: string;
  };
  unbonding_height: string;
  unbonding_time: string;
  commission: {
    commission_rates: {
      rate: string;
      max_rate: string;
      max_change_rate: string
    };
    update_time: string;
  };
  min_self_delegation: string;
  unbonding_on_hold_ref_count: string;
  unbonding_ids: unknown;
}