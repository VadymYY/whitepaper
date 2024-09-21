export enum SignatureViewStatus {
    PROPOSED = 'Proposed',
    SIGNED = 'Signed',
    MISSED = 'Missed',
}

export enum ValidatorStatus {
    UN_BONDED = 'BOND_STATUS_UNBONDED',
    BONDED = 'BOND_STATUS_BONDED',
}

export enum ValidatorStatusView {
    BONDED = 'Bonded',
    UN_BONDED = 'UnBonded',
}

export enum StakingCachePrefix {
    STAKING = "staking",
    GLOBAL_OVERVIEW = "global_overview",
    VALIDATORS = "validators",
    VALIDATOR_IMG = "validator_img",
    VALIDATOR_SIGNATURES = "validator_signatures",
    VALIDATOR_RECENTLY_PROPOSED_BLOCKS = "validator_recently_propored_blocks",
    LAST_BLOCK = "last_block",
  }
  