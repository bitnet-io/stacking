import { bech32, bech32m } from '@scure/base';
import { bigIntToBytes } from '@stacks/common';
import { base58CheckDecode, base58CheckEncode } from '@stacks/encryption';
import { bufferCV, ClarityType, tupleCV, } from '@stacks/transactions';
import { B58_ADDR_PREFIXES, BitcoinNetworkVersion, PoXAddressVersion, PoxOperationPeriod, SegwitPrefix, SEGWIT_ADDR_PREFIXES, SEGWIT_V0, SEGWIT_V0_ADDR_PREFIX, SEGWIT_V1, SEGWIT_V1_ADDR_PREFIX, StackingErrors, } from './constants';
import { StacksNetworks } from '@stacks/network';
export class InvalidAddressError extends Error {
    constructor(address, innerError) {
        const msg = `'${address}' is not a valid P2PKH/P2SH/P2WPKH/P2WSH/P2TR address`;
        super(msg);
        this.message = msg;
        this.name = this.constructor.name;
        this.innerError = innerError;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
export function btcAddressVersionToLegacyHashMode(btcAddressVersion) {
    switch (btcAddressVersion) {
        case BitcoinNetworkVersion.mainnet.P2PKH:
            return PoXAddressVersion.P2PKH;
        case BitcoinNetworkVersion.testnet.P2PKH:
            return PoXAddressVersion.P2PKH;
        case BitcoinNetworkVersion.mainnet.P2SH:
            return PoXAddressVersion.P2SH;
        case BitcoinNetworkVersion.testnet.P2SH:
            return PoXAddressVersion.P2SH;
        default:
            throw new Error('Invalid pox address version');
    }
}
function nativeAddressToSegwitVersion(witnessVersion, dataLength) {
    if (witnessVersion === SEGWIT_V0 && dataLength === 20)
        return PoXAddressVersion.P2WPKH;
    if (witnessVersion === SEGWIT_V0 && dataLength === 32)
        return PoXAddressVersion.P2WSH;
    if (witnessVersion === SEGWIT_V1 && dataLength === 32)
        return PoXAddressVersion.P2TR;
    throw new Error('Invalid native segwit witness version and byte length. Currently, only P2WPKH, P2WSH, and P2TR are supported.');
}
function bech32Decode(btcAddress) {
    const { words: bech32Words } = bech32.decode(btcAddress);
    const witnessVersion = bech32Words[0];
    if (witnessVersion > 0)
        throw new Error('Addresses with a witness version >= 1 should be encoded in bech32m');
    return {
        witnessVersion,
        data: bech32.fromWords(bech32Words.slice(1)),
    };
}
function bech32MDecode(btcAddress) {
    const { words: bech32MWords } = bech32m.decode(btcAddress);
    const witnessVersion = bech32MWords[0];
    if (witnessVersion == 0)
        throw new Error('Addresses with witness version 1 should be encoded in bech32');
    return {
        witnessVersion,
        data: bech32m.fromWords(bech32MWords.slice(1)),
    };
}
function decodeNativeSegwitBtcAddress(btcAddress) {
    if (SEGWIT_V0_ADDR_PREFIX.test(btcAddress))
        return bech32Decode(btcAddress);
    if (SEGWIT_V1_ADDR_PREFIX.test(btcAddress))
        return bech32MDecode(btcAddress);
    throw new Error(`Native segwit address ${btcAddress} does not match valid prefix ${SEGWIT_V0_ADDR_PREFIX} or ${SEGWIT_V1_ADDR_PREFIX}`);
}
export function decodeBtcAddress(btcAddress) {
    try {
        if (B58_ADDR_PREFIXES.test(btcAddress)) {
            const b58 = base58CheckDecode(btcAddress);
            const addressVersion = btcAddressVersionToLegacyHashMode(b58.version);
            return {
                version: addressVersion,
                data: b58.hash,
            };
        }
        else if (SEGWIT_ADDR_PREFIXES.test(btcAddress)) {
            const b32 = decodeNativeSegwitBtcAddress(btcAddress);
            const addressVersion = nativeAddressToSegwitVersion(b32.witnessVersion, b32.data.length);
            return {
                version: addressVersion,
                data: b32.data,
            };
        }
        throw new Error('Unknown BTC address prefix.');
    }
    catch (error) {
        throw new InvalidAddressError(btcAddress, error);
    }
}
export function extractPoxAddressFromClarityValue(poxAddrClarityValue) {
    const clarityValue = poxAddrClarityValue;
    if (clarityValue.type !== ClarityType.Tuple || !clarityValue.data) {
        throw new Error('Invalid argument, expected ClarityValue to be a TupleCV');
    }
    if (!('version' in clarityValue.data) || !('hashbytes' in clarityValue.data)) {
        throw new Error('Invalid argument, expected Clarity tuple value to contain `version` and `hashbytes` keys');
    }
    const versionCV = clarityValue.data['version'];
    const hashBytesCV = clarityValue.data['hashbytes'];
    if (versionCV.type !== ClarityType.Buffer || hashBytesCV.type !== ClarityType.Buffer) {
        throw new Error('Invalid argument, expected Clarity tuple value to contain `version` and `hashbytes` buffers');
    }
    return {
        version: versionCV.buffer[0],
        hashBytes: hashBytesCV.buffer,
    };
}
export function getErrorString(error) {
    switch (error) {
        case StackingErrors.ERR_STACKING_UNREACHABLE:
            return 'Stacking unreachable';
        case StackingErrors.ERR_STACKING_CORRUPTED_STATE:
            return 'Stacking state is corrupted';
        case StackingErrors.ERR_STACKING_INSUFFICIENT_FUNDS:
            return 'Insufficient funds';
        case StackingErrors.ERR_STACKING_INVALID_LOCK_PERIOD:
            return 'Invalid lock period';
        case StackingErrors.ERR_STACKING_ALREADY_STACKED:
            return 'Account already stacked. Concurrent stacking not allowed.';
        case StackingErrors.ERR_STACKING_NO_SUCH_PRINCIPAL:
            return 'Principal does not exist';
        case StackingErrors.ERR_STACKING_EXPIRED:
            return 'Stacking expired';
        case StackingErrors.ERR_STACKING_STX_LOCKED:
            return 'STX balance is locked';
        case StackingErrors.ERR_STACKING_PERMISSION_DENIED:
            return 'Permission denied';
        case StackingErrors.ERR_STACKING_THRESHOLD_NOT_MET:
            return 'Stacking threshold not met';
        case StackingErrors.ERR_STACKING_POX_ADDRESS_IN_USE:
            return 'PoX address already in use';
        case StackingErrors.ERR_STACKING_INVALID_POX_ADDRESS:
            return 'Invalid PoX address';
        case StackingErrors.ERR_STACKING_ALREADY_REJECTED:
            return 'Stacking already rejected';
        case StackingErrors.ERR_STACKING_INVALID_AMOUNT:
            return 'Invalid amount';
        case StackingErrors.ERR_NOT_ALLOWED:
            return 'Stacking not allowed';
        case StackingErrors.ERR_STACKING_ALREADY_DELEGATED:
            return 'Already delegated';
        case StackingErrors.ERR_DELEGATION_EXPIRES_DURING_LOCK:
            return 'Delegation expires during lock period';
        case StackingErrors.ERR_DELEGATION_TOO_MUCH_LOCKED:
            return 'Delegation too much locked';
        case StackingErrors.ERR_DELEGATION_POX_ADDR_REQUIRED:
            return 'PoX address required for delegation';
        case StackingErrors.ERR_INVALID_START_BURN_HEIGHT:
            return 'Invalid start burn height';
        case StackingErrors.ERR_NOT_CURRENT_STACKER:
            return 'ERR_NOT_CURRENT_STACKER';
        case StackingErrors.ERR_STACK_EXTEND_NOT_LOCKED:
            return 'Stacker must be currently locked';
        case StackingErrors.ERR_STACK_INCREASE_NOT_LOCKED:
            return 'Stacker must be currently locked';
        case StackingErrors.ERR_DELEGATION_NO_REWARD_SLOT:
            return 'Invalid reward-cycle and reward-cycle-index';
        case StackingErrors.ERR_DELEGATION_WRONG_REWARD_SLOT:
            return 'PoX address must match the one on record';
        case StackingErrors.ERR_STACKING_IS_DELEGATED:
            return 'Stacker must be directly stacking and not delegating';
        case StackingErrors.ERR_STACKING_NOT_DELEGATED:
            return 'Stacker must be delegating and not be directly stacking';
    }
}
export function poxAddressToTuple(poxAddress) {
    const { version, data } = decodeBtcAddress(poxAddress);
    const versionBuff = bufferCV(bigIntToBytes(BigInt(version), 1));
    const hashBuff = bufferCV(data);
    return tupleCV({
        version: versionBuff,
        hashbytes: hashBuff,
    });
}
function legacyHashModeToBtcAddressVersion(hashMode, network) {
    switch (hashMode) {
        case PoXAddressVersion.P2PKH:
            return BitcoinNetworkVersion[network].P2PKH;
        case PoXAddressVersion.P2SH:
        case PoXAddressVersion.P2SHP2WPKH:
        case PoXAddressVersion.P2SHP2WSH:
            return BitcoinNetworkVersion[network].P2SH;
        default:
            throw new Error('Invalid pox address version');
    }
}
function _poxAddressToBtcAddress_Values(version, hashBytes, network) {
    if (!StacksNetworks.includes(network))
        throw new Error('Invalid network.');
    switch (version) {
        case PoXAddressVersion.P2PKH:
        case PoXAddressVersion.P2SH:
        case PoXAddressVersion.P2SHP2WPKH:
        case PoXAddressVersion.P2SHP2WSH: {
            const btcAddrVersion = legacyHashModeToBtcAddressVersion(version, network);
            return base58CheckEncode(btcAddrVersion, hashBytes);
        }
        case PoXAddressVersion.P2WPKH:
        case PoXAddressVersion.P2WSH: {
            const words = bech32.toWords(hashBytes);
            return bech32.encode(SegwitPrefix[network], [SEGWIT_V0, ...words]);
        }
        case PoXAddressVersion.P2TR: {
            const words = bech32m.toWords(hashBytes);
            return bech32m.encode(SegwitPrefix[network], [SEGWIT_V1, ...words]);
        }
    }
    throw new Error(`Unexpected address version: ${version}`);
}
function _poxAddressToBtcAddress_ClarityValue(poxAddrClarityValue, network) {
    const poxAddr = extractPoxAddressFromClarityValue(poxAddrClarityValue);
    return _poxAddressToBtcAddress_Values(poxAddr.version, poxAddr.hashBytes, network);
}
export function poxAddressToBtcAddress(...args) {
    if (typeof args[0] === 'number')
        return _poxAddressToBtcAddress_Values(args[0], args[1], args[2]);
    return _poxAddressToBtcAddress_ClarityValue(args[0], args[1]);
}
export function unwrap(optional) {
    if (optional.type === ClarityType.OptionalSome)
        return optional.value;
    if (optional.type === ClarityType.OptionalNone)
        return undefined;
    throw new Error("Object is not an 'Optional'");
}
export function unwrapMap(optional, map) {
    if (optional.type === ClarityType.OptionalSome)
        return map(optional.value);
    if (optional.type === ClarityType.OptionalNone)
        return undefined;
    throw new Error("Object is not an 'Optional'");
}
export function ensurePox2Activated(operationInfo) {
    if (operationInfo.period === PoxOperationPeriod.Period1)
        throw new Error(`PoX-2 has not activated yet (currently in period ${operationInfo.period} of PoX-2 operation)`);
}
export function ensureLegacyBtcAddressForPox1({ contract, poxAddress, }) {
    if (!poxAddress)
        return;
    if (contract.endsWith('.pox') && !B58_ADDR_PREFIXES.test(poxAddress)) {
        throw new Error('PoX-1 requires P2PKH/P2SH/P2SH-P2WPKH/P2SH-P2WSH bitcoin addresses');
    }
}
//# sourceMappingURL=utils.js.map