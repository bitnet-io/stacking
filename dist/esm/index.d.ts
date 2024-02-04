import { IntegerType } from '@stacks/common';
import { StacksNetwork } from '@stacks/network';
import { BurnchainRewardListResponse, BurnchainRewardSlotHolderListResponse, BurnchainRewardsTotal } from '@stacks/stacks-blockchain-api-types';
import { ContractCallOptions, StacksTransaction, TxBroadcastResult } from '@stacks/transactions';
import { PoxOperationPeriod } from './constants';
export * from './utils';
export interface CycleInfo {
    id: number;
    min_threshold_ustx: number;
    stacked_ustx: number;
    is_pox_active: boolean;
}
export interface ContractVersion {
    contract_id: string;
    activation_burnchain_block_height: number;
    first_reward_cycle_id: number;
}
export interface PoxInfo {
    contract_id: string;
    contract_versions?: ContractVersion[];
    current_burnchain_block_height?: number;
    first_burnchain_block_height: number;
    min_amount_ustx: string;
    next_reward_cycle_in: number;
    prepare_cycle_length: number;
    prepare_phase_block_length: number;
    rejection_fraction: number;
    rejection_votes_left_required: number;
    reward_cycle_id: number;
    reward_cycle_length: number;
    reward_phase_block_length: number;
    reward_slots: number;
    current_cycle: CycleInfo;
    next_cycle: CycleInfo & {
        min_increment_ustx: number;
        prepare_phase_start_block_height: number;
        blocks_until_prepare_phase: number;
        reward_phase_start_block_height: number;
        blocks_until_reward_phase: number;
        ustx_until_pox_rejection: number;
    };
}
export type PoxOperationInfo = {
    period: PoxOperationPeriod.Period1;
    pox1: {
        contract_id: string;
    };
} | {
    period: PoxOperationPeriod;
    pox1: {
        contract_id: string;
    };
    pox2: ContractVersion;
    current: ContractVersion;
} | {
    period: PoxOperationPeriod.Period3;
    pox1: {
        contract_id: string;
    };
    pox2: ContractVersion;
    pox3: ContractVersion;
    current: ContractVersion;
};
export interface AccountExtendedBalances {
    stx: {
        balance: IntegerType;
        total_sent: IntegerType;
        total_received: IntegerType;
        locked: IntegerType;
        lock_tx_id: string;
        lock_height: number;
        burnchain_lock_height: number;
        burnchain_unlock_height: number;
    };
    fungible_tokens: any;
    non_fungible_tokens: any;
}
export type StackerInfo = {
    stacked: false;
} | {
    stacked: true;
    details: {
        first_reward_cycle: number;
        lock_period: number;
        unlock_height: number;
        pox_address: {
            version: Uint8Array;
            hashbytes: Uint8Array;
        };
    };
};
export type DelegationInfo = {
    delegated: false;
} | {
    delegated: true;
    details: {
        amount_micro_stx: bigint;
        delegated_to: string;
        pox_address: {
            version: Uint8Array;
            hashbytes: Uint8Array;
        } | undefined;
        until_burn_ht: number | undefined;
    };
};
export interface BlockTimeInfo {
    mainnet: {
        target_block_time: number;
    };
    testnet: {
        target_block_time: number;
    };
}
export interface CoreInfo {
    burn_block_height: number;
    stable_pox_consensus: string;
}
export interface BalanceInfo {
    balance: string;
    nonce: number;
}
export interface PaginationOptions {
    limit: number;
    offset: number;
}
export interface RewardsError {
    error: string;
}
export interface RewardSetOptions {
    contractId: string;
    rewardCyleId: number;
    rewardSetIndex: number;
}
export interface RewardSetInfo {
    pox_address: {
        version: Uint8Array;
        hashbytes: Uint8Array;
    };
    total_ustx: bigint;
}
export interface StackingEligibility {
    eligible: boolean;
    reason?: string;
}
export interface CanLockStxOptions {
    poxAddress: string;
    cycles: number;
}
export interface LockStxOptions {
    privateKey: string;
    cycles: number;
    poxAddress: string;
    amountMicroStx: IntegerType;
    burnBlockHeight: number;
}
export interface StackExtendOptions {
    privateKey: string;
    extendCycles: number;
    poxAddress: string;
}
export interface StackIncreaseOptions {
    privateKey: string;
    increaseBy: IntegerType;
}
export interface DelegateStxOptions {
    amountMicroStx: IntegerType;
    delegateTo: string;
    untilBurnBlockHeight?: number;
    poxAddress?: string;
    privateKey: string;
}
export interface DelegateStackStxOptions {
    stacker: string;
    amountMicroStx: IntegerType;
    poxAddress: string;
    burnBlockHeight: number;
    cycles: number;
    privateKey: string;
}
export interface DelegateStackExtendOptions {
    stacker: string;
    poxAddress: string;
    extendCount: number;
    privateKey: string;
}
export interface DelegateStackIncreaseOptions {
    stacker: string;
    poxAddress: string;
    increaseBy: IntegerType;
    privateKey: string;
    nonce?: IntegerType;
}
export interface StackAggregationCommitOptions {
    poxAddress: string;
    rewardCycle: number;
    privateKey: string;
}
export interface StackAggregationIncreaseOptions {
    poxAddress: string;
    rewardCycle: number;
    rewardIndex: number;
    privateKey: string;
}
export declare class StackingClient {
    address: string;
    network: StacksNetwork;
    constructor(address: string, network: StacksNetwork);
    getCoreInfo(): Promise<CoreInfo>;
    getPoxInfo(): Promise<PoxInfo>;
    getTargetBlockTime(): Promise<number>;
    getAccountStatus(): Promise<any>;
    getAccountBalance(): Promise<bigint>;
    getAccountExtendedBalances(): Promise<AccountExtendedBalances>;
    getAccountBalanceLocked(): Promise<bigint>;
    getCycleDuration(): Promise<number>;
    getRewardsTotalForBtcAddress(): Promise<BurnchainRewardsTotal | RewardsError>;
    getRewardsForBtcAddress(options?: PaginationOptions): Promise<BurnchainRewardListResponse | RewardsError>;
    getRewardHoldersForBtcAddress(options?: PaginationOptions): Promise<BurnchainRewardSlotHolderListResponse | RewardsError>;
    getRewardSet(options: RewardSetOptions): Promise<RewardSetInfo | undefined>;
    getSecondsUntilNextCycle(): Promise<number>;
    getSecondsUntilStackingDeadline(): Promise<number>;
    getPoxOperationInfo(poxInfo?: PoxInfo): Promise<PoxOperationInfo>;
    isStackingEnabledNextCycle(): Promise<boolean>;
    hasMinimumStx(): Promise<boolean>;
    canStack({ poxAddress, cycles }: CanLockStxOptions): Promise<StackingEligibility>;
    stack({ amountMicroStx, poxAddress, cycles, burnBlockHeight, ...txOptions }: LockStxOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    stackExtend({ extendCycles, poxAddress, ...txOptions }: StackExtendOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    stackIncrease({ increaseBy, ...txOptions }: StackIncreaseOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    delegateStx({ amountMicroStx, delegateTo, untilBurnBlockHeight, poxAddress, ...txOptions }: DelegateStxOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    delegateStackStx({ stacker, amountMicroStx, poxAddress, burnBlockHeight, cycles, ...txOptions }: DelegateStackStxOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    delegateStackExtend({ stacker, poxAddress, extendCount, ...txOptions }: DelegateStackExtendOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    delegateStackIncrease({ stacker, poxAddress, increaseBy, ...txOptions }: DelegateStackIncreaseOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    stackAggregationCommit({ poxAddress, rewardCycle, ...txOptions }: StackAggregationCommitOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    stackAggregationCommitIndexed({ poxAddress, rewardCycle, ...txOptions }: StackAggregationCommitOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    stackAggregationIncrease({ poxAddress, rewardCycle, rewardIndex, ...txOptions }: StackAggregationIncreaseOptions & BaseTxOptions): Promise<TxBroadcastResult>;
    revokeDelegateStx(privateKey: string): Promise<TxBroadcastResult>;
    revokeDelegateStx(txOptions: BaseTxOptions): Promise<TxBroadcastResult>;
    getStackOptions({ amountMicroStx, poxAddress, cycles, contract, burnBlockHeight, }: {
        cycles: number;
        poxAddress: string;
        amountMicroStx: IntegerType;
        contract: string;
        burnBlockHeight: number;
    }): ContractCallOptions;
    getStackExtendOptions({ extendCycles, poxAddress, contract, }: {
        extendCycles: number;
        poxAddress: string;
        contract: string;
    }): ContractCallOptions;
    getStackIncreaseOptions({ increaseBy, contract }: {
        increaseBy: IntegerType;
        contract: string;
    }): ContractCallOptions;
    getDelegateOptions({ contract, amountMicroStx, delegateTo, untilBurnBlockHeight, poxAddress, }: {
        contract: string;
        amountMicroStx: IntegerType;
        delegateTo: string;
        untilBurnBlockHeight?: number;
        poxAddress?: string;
    }): ContractCallOptions;
    getDelegateStackOptions({ contract, stacker, amountMicroStx, poxAddress, burnBlockHeight, cycles, }: {
        contract: string;
        stacker: string;
        amountMicroStx: IntegerType;
        poxAddress: string;
        burnBlockHeight: number;
        cycles: number;
    }): ContractCallOptions;
    getDelegateStackExtendOptions({ contract, stacker, poxAddress, extendCount, }: {
        contract: string;
        stacker: string;
        poxAddress: string;
        extendCount: number;
    }): ContractCallOptions;
    getDelegateStackIncreaseOptions({ contract, stacker, poxAddress, increaseBy, }: {
        contract: string;
        stacker: string;
        poxAddress: string;
        increaseBy: IntegerType;
    }): ContractCallOptions;
    getStackAggregationCommitOptions({ contract, poxAddress, rewardCycle, }: {
        contract: string;
        poxAddress: string;
        rewardCycle: number;
    }): ContractCallOptions;
    getStackAggregationIncreaseOptions({ contract, poxAddress, rewardCycle, rewardCycleIndex, }: {
        contract: string;
        poxAddress: string;
        rewardCycle: number;
        rewardCycleIndex: number;
    }): ContractCallOptions;
    getStackAggregationCommitOptionsIndexed({ contract, poxAddress, rewardCycle, }: {
        contract: string;
        poxAddress: string;
        rewardCycle: number;
    }): ContractCallOptions;
    getRevokeDelegateStxOptions(contract: string): ContractCallOptions;
    getStatus(): Promise<StackerInfo>;
    getDelegationStatus(): Promise<DelegationInfo>;
    getStackingContract(poxOperationInfo?: PoxOperationInfo): Promise<string>;
    modifyLockTxFee({ tx, amountMicroStx }: {
        tx: StacksTransaction;
        amountMicroStx: IntegerType;
    }): StacksTransaction;
    parseContractId(contract: string): string[];
}
