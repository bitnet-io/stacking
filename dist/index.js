"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StackingClient = void 0;
const common_1 = require("@stacks/common");
const transactions_1 = require("@stacks/transactions");
const constants_1 = require("./constants");
const utils_1 = require("./utils");
__exportStar(require("./utils"), exports);
class StackingClient {
    constructor(address, network) {
        this.address = address;
        this.network = network;
    }
    async getCoreInfo() {
        const url = this.network.getInfoUrl();
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getPoxInfo() {
        const url = this.network.getPoxInfoUrl();
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getTargetBlockTime() {
        const url = this.network.getBlockTimeInfoUrl();
        const res = await this.network.fetchFn(url).then(res => res.json());
        if (this.network.isMainnet()) {
            return res.mainnet.target_block_time;
        }
        else {
            return res.testnet.target_block_time;
        }
    }
    async getAccountStatus() {
        const url = this.network.getAccountApiUrl(this.address);
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getAccountBalance() {
        return this.getAccountStatus().then(res => {
            return BigInt(res.balance);
        });
    }
    async getAccountExtendedBalances() {
        const url = this.network.getAccountExtendedBalancesApiUrl(this.address);
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getAccountBalanceLocked() {
        return this.getAccountStatus().then(res => BigInt(res.locked));
    }
    async getCycleDuration() {
        const poxInfoPromise = this.getPoxInfo();
        const targetBlockTimePromise = await this.getTargetBlockTime();
        return Promise.all([poxInfoPromise, targetBlockTimePromise]).then(([poxInfo, targetBlockTime]) => {
            return poxInfo.reward_cycle_length * targetBlockTime;
        });
    }
    async getRewardsTotalForBtcAddress() {
        const url = this.network.getRewardsTotalUrl(this.address);
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getRewardsForBtcAddress(options) {
        const url = `${this.network.getRewardsUrl(this.address, options)}`;
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getRewardHoldersForBtcAddress(options) {
        const url = `${this.network.getRewardHoldersUrl(this.address, options)}`;
        return this.network.fetchFn(url).then(res => res.json());
    }
    async getRewardSet(options) {
        const [contractAddress, contractName] = this.parseContractId(options?.contractId);
        const result = await (0, transactions_1.callReadOnlyFunction)({
            network: this.network,
            senderAddress: this.address,
            contractAddress,
            contractName,
            functionArgs: [(0, transactions_1.uintCV)(options.rewardCyleId), (0, transactions_1.uintCV)(options.rewardSetIndex)],
            functionName: 'get-reward-set-pox-address',
        });
        return (0, utils_1.unwrapMap)(result, tuple => ({
            pox_address: {
                version: tuple.data['pox-addr'].data['version'].buffer,
                hashbytes: tuple.data['pox-addr'].data['hashbytes'].buffer,
            },
            total_ustx: tuple.data['total-ustx'].value,
        }));
    }
    async getSecondsUntilNextCycle() {
        const poxInfoPromise = this.getPoxInfo();
        const targetBlockTimePromise = this.getTargetBlockTime();
        const coreInfoPromise = this.getCoreInfo();
        return Promise.all([poxInfoPromise, targetBlockTimePromise, coreInfoPromise]).then(([poxInfo, targetBlockTime, coreInfo]) => {
            const blocksToNextCycle = poxInfo.reward_cycle_length -
                ((coreInfo.burn_block_height - poxInfo.first_burnchain_block_height) %
                    poxInfo.reward_cycle_length);
            return blocksToNextCycle * targetBlockTime;
        });
    }
    async getSecondsUntilStackingDeadline() {
        const poxInfoPromise = this.getPoxInfo();
        const targetBlockTimePromise = this.getTargetBlockTime();
        return Promise.all([poxInfoPromise, targetBlockTimePromise]).then(([poxInfo, targetBlockTime]) => poxInfo.next_cycle.blocks_until_prepare_phase * targetBlockTime);
    }
    async getPoxOperationInfo(poxInfo) {
        poxInfo = poxInfo ?? (await this.getPoxInfo());
        if (!poxInfo.current_burnchain_block_height ||
            !poxInfo.contract_versions ||
            poxInfo.contract_versions.length <= 1) {
            return { period: constants_1.PoxOperationPeriod.Period1, pox1: { contract_id: poxInfo.contract_id } };
        }
        const poxContractVersions = [...poxInfo.contract_versions].sort((a, b) => a.activation_burnchain_block_height - b.activation_burnchain_block_height);
        const [pox1, pox2, pox3] = poxContractVersions;
        const activatedPoxs = poxContractVersions.filter((c) => poxInfo?.current_burnchain_block_height >= c.activation_burnchain_block_height);
        const current = activatedPoxs[activatedPoxs.length - 1];
        if (poxInfo.contract_versions.length == 2) {
            const [address, name] = pox2.contract_id.split('.');
            const pox2ConfiguredUrl = this.network.getDataVarUrl(address, name, 'configured');
            const isPox2NotYetConfigured = (await this.network.fetchFn(pox2ConfiguredUrl).then(r => r.text())) !== '{"data":"0x03"}';
            if (isPox2NotYetConfigured) {
                return { period: constants_1.PoxOperationPeriod.Period1, pox1, pox2 };
            }
        }
        if (poxInfo.contract_id === pox1.contract_id) {
            return { period: constants_1.PoxOperationPeriod.Period2a, pox1, pox2, current };
        }
        if (poxInfo.contract_id === pox2.contract_id) {
            if (poxInfo.current_cycle.id < pox2.first_reward_cycle_id) {
                return { period: constants_1.PoxOperationPeriod.Period2b, pox1, pox2, current };
            }
            return { period: constants_1.PoxOperationPeriod.Period3, pox1, pox2, current };
        }
        if (activatedPoxs.length > 2) {
            return { period: constants_1.PoxOperationPeriod.Period3, pox1, pox2, pox3, current };
        }
        throw new Error('Could not determine PoX Operation Period');
    }
    async isStackingEnabledNextCycle() {
        return (await this.getPoxInfo()).rejection_votes_left_required > 0;
    }
    async hasMinimumStx() {
        const balance = await this.getAccountBalance();
        const min = BigInt((await this.getPoxInfo()).min_amount_ustx);
        return balance >= min;
    }
    async canStack({ poxAddress, cycles }) {
        const balancePromise = this.getAccountBalance();
        const poxInfoPromise = this.getPoxInfo();
        return Promise.all([balancePromise, poxInfoPromise])
            .then(([balance, poxInfo]) => {
            const address = (0, utils_1.poxAddressToTuple)(poxAddress);
            const [contractAddress, contractName] = this.parseContractId(poxInfo.contract_id);
            return (0, transactions_1.callReadOnlyFunction)({
                network: this.network,
                contractName,
                contractAddress,
                functionName: 'can-stack-stx',
                senderAddress: this.address,
                functionArgs: [
                    address,
                    (0, transactions_1.uintCV)(balance.toString()),
                    (0, transactions_1.uintCV)(poxInfo.reward_cycle_id),
                    (0, transactions_1.uintCV)(cycles.toString()),
                ],
            });
        })
            .then((responseCV) => {
            if (responseCV.type === transactions_1.ClarityType.ResponseOk) {
                return {
                    eligible: true,
                };
            }
            else {
                const errorCV = responseCV;
                return {
                    eligible: false,
                    reason: constants_1.StackingErrors[+(0, transactions_1.cvToString)(errorCV.value)],
                };
            }
        });
    }
    async stack({ amountMicroStx, poxAddress, cycles, burnBlockHeight, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const poxOperationInfo = await this.getPoxOperationInfo(poxInfo);
        const contract = await this.getStackingContract(poxOperationInfo);
        (0, utils_1.ensureLegacyBtcAddressForPox1)({ contract, poxAddress });
        const callOptions = this.getStackOptions({
            amountMicroStx,
            cycles,
            poxAddress,
            contract,
            burnBlockHeight,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async stackExtend({ extendCycles, poxAddress, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const poxOperationInfo = await this.getPoxOperationInfo(poxInfo);
        (0, utils_1.ensurePox2Activated)(poxOperationInfo);
        const callOptions = this.getStackExtendOptions({
            contract: poxInfo.contract_id,
            extendCycles,
            poxAddress,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async stackIncrease({ increaseBy, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const poxOperationInfo = await this.getPoxOperationInfo(poxInfo);
        (0, utils_1.ensurePox2Activated)(poxOperationInfo);
        const callOptions = this.getStackIncreaseOptions({
            contract: poxInfo.contract_id,
            increaseBy,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async delegateStx({ amountMicroStx, delegateTo, untilBurnBlockHeight, poxAddress, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const poxOperationInfo = await this.getPoxOperationInfo(poxInfo);
        const contract = await this.getStackingContract(poxOperationInfo);
        (0, utils_1.ensureLegacyBtcAddressForPox1)({ contract, poxAddress });
        const callOptions = this.getDelegateOptions({
            contract,
            amountMicroStx,
            delegateTo,
            untilBurnBlockHeight,
            poxAddress,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async delegateStackStx({ stacker, amountMicroStx, poxAddress, burnBlockHeight, cycles, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const poxOperationInfo = await this.getPoxOperationInfo(poxInfo);
        const contract = await this.getStackingContract(poxOperationInfo);
        (0, utils_1.ensureLegacyBtcAddressForPox1)({ contract, poxAddress });
        const callOptions = this.getDelegateStackOptions({
            contract,
            stacker,
            amountMicroStx,
            poxAddress,
            burnBlockHeight,
            cycles,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async delegateStackExtend({ stacker, poxAddress, extendCount, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const contract = poxInfo.contract_id;
        const callOptions = this.getDelegateStackExtendOptions({
            contract,
            stacker,
            poxAddress,
            extendCount,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async delegateStackIncrease({ stacker, poxAddress, increaseBy, ...txOptions }) {
        const poxInfo = await this.getPoxInfo();
        const poxOperationInfo = await this.getPoxOperationInfo(poxInfo);
        (0, utils_1.ensurePox2Activated)(poxOperationInfo);
        const callOptions = this.getDelegateStackIncreaseOptions({
            contract: poxInfo.contract_id,
            stacker,
            poxAddress,
            increaseBy,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async stackAggregationCommit({ poxAddress, rewardCycle, ...txOptions }) {
        const contract = await this.getStackingContract();
        (0, utils_1.ensureLegacyBtcAddressForPox1)({ contract, poxAddress });
        const callOptions = this.getStackAggregationCommitOptions({
            contract,
            poxAddress,
            rewardCycle,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async stackAggregationCommitIndexed({ poxAddress, rewardCycle, ...txOptions }) {
        const contract = await this.getStackingContract();
        (0, utils_1.ensureLegacyBtcAddressForPox1)({ contract, poxAddress });
        const callOptions = this.getStackAggregationCommitOptionsIndexed({
            contract,
            poxAddress,
            rewardCycle,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async stackAggregationIncrease({ poxAddress, rewardCycle, rewardIndex, ...txOptions }) {
        const contract = await this.getStackingContract();
        (0, utils_1.ensureLegacyBtcAddressForPox1)({ contract, poxAddress });
        const callOptions = this.getStackAggregationIncreaseOptions({
            contract,
            poxAddress,
            rewardCycle,
            rewardCycleIndex: rewardIndex,
        });
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(txOptions),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    async revokeDelegateStx(arg) {
        if (typeof arg === 'string')
            arg = { privateKey: arg };
        const poxInfo = await this.getPoxInfo();
        const contract = poxInfo.contract_id;
        const callOptions = this.getRevokeDelegateStxOptions(contract);
        const tx = await (0, transactions_1.makeContractCall)({
            ...callOptions,
            ...renamePrivateKey(arg),
        });
        return (0, transactions_1.broadcastTransaction)(tx, callOptions.network);
    }
    getStackOptions({ amountMicroStx, poxAddress, cycles, contract, burnBlockHeight, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'stack-stx',
            functionArgs: [(0, transactions_1.uintCV)(amountMicroStx), address, (0, transactions_1.uintCV)(burnBlockHeight), (0, transactions_1.uintCV)(cycles)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getStackExtendOptions({ extendCycles, poxAddress, contract, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'stack-extend',
            functionArgs: [(0, transactions_1.uintCV)(extendCycles), address],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getStackIncreaseOptions({ increaseBy, contract }) {
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'stack-increase',
            functionArgs: [(0, transactions_1.uintCV)(increaseBy)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getDelegateOptions({ contract, amountMicroStx, delegateTo, untilBurnBlockHeight, poxAddress, }) {
        const address = poxAddress ? (0, transactions_1.someCV)((0, utils_1.poxAddressToTuple)(poxAddress)) : (0, transactions_1.noneCV)();
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'delegate-stx',
            functionArgs: [
                (0, transactions_1.uintCV)(amountMicroStx),
                (0, transactions_1.principalCV)(delegateTo),
                untilBurnBlockHeight ? (0, transactions_1.someCV)((0, transactions_1.uintCV)(untilBurnBlockHeight)) : (0, transactions_1.noneCV)(),
                address,
            ],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getDelegateStackOptions({ contract, stacker, amountMicroStx, poxAddress, burnBlockHeight, cycles, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'delegate-stack-stx',
            functionArgs: [
                (0, transactions_1.principalCV)(stacker),
                (0, transactions_1.uintCV)(amountMicroStx),
                address,
                (0, transactions_1.uintCV)(burnBlockHeight),
                (0, transactions_1.uintCV)(cycles),
            ],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getDelegateStackExtendOptions({ contract, stacker, poxAddress, extendCount, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'delegate-stack-extend',
            functionArgs: [(0, transactions_1.principalCV)(stacker), address, (0, transactions_1.uintCV)(extendCount)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getDelegateStackIncreaseOptions({ contract, stacker, poxAddress, increaseBy, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'delegate-stack-increase',
            functionArgs: [(0, transactions_1.principalCV)(stacker), address, (0, transactions_1.uintCV)(increaseBy)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getStackAggregationCommitOptions({ contract, poxAddress, rewardCycle, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'stack-aggregation-commit',
            functionArgs: [address, (0, transactions_1.uintCV)(rewardCycle)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getStackAggregationIncreaseOptions({ contract, poxAddress, rewardCycle, rewardCycleIndex, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'stack-aggregation-increase',
            functionArgs: [address, (0, transactions_1.uintCV)(rewardCycle), (0, transactions_1.uintCV)(rewardCycleIndex)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getStackAggregationCommitOptionsIndexed({ contract, poxAddress, rewardCycle, }) {
        const address = (0, utils_1.poxAddressToTuple)(poxAddress);
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'stack-aggregation-commit-indexed',
            functionArgs: [address, (0, transactions_1.uintCV)(rewardCycle)],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    getRevokeDelegateStxOptions(contract) {
        const [contractAddress, contractName] = this.parseContractId(contract);
        const callOptions = {
            contractAddress,
            contractName,
            functionName: 'revoke-delegate-stx',
            functionArgs: [],
            validateWithAbi: true,
            network: this.network,
            anchorMode: transactions_1.AnchorMode.Any,
        };
        return callOptions;
    }
    async getStatus() {
        const poxInfo = await this.getPoxInfo();
        const [contractAddress, contractName] = this.parseContractId(poxInfo.contract_id);
        const account = await this.getAccountStatus();
        const functionName = 'get-stacker-info';
        return (0, transactions_1.callReadOnlyFunction)({
            contractAddress,
            contractName,
            functionName,
            senderAddress: this.address,
            functionArgs: [(0, transactions_1.principalCV)(this.address)],
            network: this.network,
        }).then((responseCV) => {
            if (responseCV.type === transactions_1.ClarityType.OptionalSome) {
                const someCV = responseCV;
                const tupleCV = someCV.value;
                const poxAddress = tupleCV.data['pox-addr'];
                const firstRewardCycle = tupleCV.data['first-reward-cycle'];
                const lockPeriod = tupleCV.data['lock-period'];
                const version = poxAddress.data['version'];
                const hashbytes = poxAddress.data['hashbytes'];
                return {
                    stacked: true,
                    details: {
                        first_reward_cycle: Number(firstRewardCycle.value),
                        lock_period: Number(lockPeriod.value),
                        unlock_height: account.unlock_height,
                        pox_address: {
                            version: version.buffer,
                            hashbytes: hashbytes.buffer,
                        },
                    },
                };
            }
            else if (responseCV.type === transactions_1.ClarityType.OptionalNone) {
                return {
                    stacked: false,
                };
            }
            else {
                throw new Error(`Error fetching stacker info`);
            }
        });
    }
    async getDelegationStatus() {
        const poxInfo = await this.getPoxInfo();
        const [contractAddress, contractName] = this.parseContractId(poxInfo.contract_id);
        const functionName = 'get-delegation-info';
        return (0, transactions_1.callReadOnlyFunction)({
            contractAddress,
            contractName,
            functionName,
            senderAddress: this.address,
            functionArgs: [(0, transactions_1.principalCV)(this.address)],
            network: this.network,
        }).then((responseCV) => {
            if (responseCV.type === transactions_1.ClarityType.OptionalSome) {
                const tupleCV = responseCV.value;
                const amountMicroStx = tupleCV.data['amount-ustx'];
                const delegatedTo = tupleCV.data['delegated-to'];
                const poxAddress = (0, utils_1.unwrapMap)(tupleCV.data['pox-addr'], tuple => ({
                    version: tuple.data['version'].buffer,
                    hashbytes: tuple.data['hashbytes'].buffer,
                }));
                const untilBurnBlockHeight = (0, utils_1.unwrap)(tupleCV.data['until-burn-ht']);
                return {
                    delegated: true,
                    details: {
                        amount_micro_stx: BigInt(amountMicroStx.value),
                        delegated_to: (0, transactions_1.principalToString)(delegatedTo),
                        pox_address: poxAddress,
                        until_burn_ht: untilBurnBlockHeight ? Number(untilBurnBlockHeight.value) : undefined,
                    },
                };
            }
            else if (responseCV.type === transactions_1.ClarityType.OptionalNone) {
                return {
                    delegated: false,
                };
            }
            else {
                throw new Error(`Error fetching delegation info`);
            }
        });
    }
    async getStackingContract(poxOperationInfo) {
        poxOperationInfo = poxOperationInfo ?? (await this.getPoxOperationInfo());
        switch (poxOperationInfo.period) {
            case constants_1.PoxOperationPeriod.Period1:
                return poxOperationInfo.pox1.contract_id;
            case constants_1.PoxOperationPeriod.Period2a:
            case constants_1.PoxOperationPeriod.Period2b:
                return poxOperationInfo.pox2.contract_id;
            case constants_1.PoxOperationPeriod.Period3:
            default:
                return poxOperationInfo.current.contract_id;
        }
    }
    modifyLockTxFee({ tx, amountMicroStx }) {
        const fee = (0, transactions_1.getFee)(tx.auth);
        tx.payload.functionArgs[0] = (0, transactions_1.uintCV)((0, common_1.intToBigInt)(amountMicroStx, false) - fee);
        return tx;
    }
    parseContractId(contract) {
        const parts = contract.split('.');
        if (parts.length === 2 && (0, transactions_1.validateStacksAddress)(parts[0]) && parts[1].startsWith('pox')) {
            return parts;
        }
        throw new Error('Stacking contract ID is malformed');
    }
}
exports.StackingClient = StackingClient;
function renamePrivateKey(txOptions) {
    txOptions.senderKey = txOptions.privateKey;
    delete txOptions.privateKey;
    return txOptions;
}
//# sourceMappingURL=index.js.map