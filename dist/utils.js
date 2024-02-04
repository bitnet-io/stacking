"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLegacyBtcAddressForPox1 = exports.ensurePox2Activated = exports.unwrapMap = exports.unwrap = exports.poxAddressToBtcAddress = exports.poxAddressToTuple = exports.getErrorString = exports.extractPoxAddressFromClarityValue = exports.decodeBtcAddress = exports.btcAddressVersionToLegacyHashMode = exports.InvalidAddressError = void 0;
const base_1 = require("@scure/base");
const common_1 = require("@stacks/common");
const encryption_1 = require("@stacks/encryption");
const transactions_1 = require("@stacks/transactions");
const constants_1 = require("./constants");
const network_1 = require("@stacks/network");
class InvalidAddressError extends Error {
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
exports.InvalidAddressError = InvalidAddressError;
function btcAddressVersionToLegacyHashMode(btcAddressVersion) {
    switch (btcAddressVersion) {
        case constants_1.BitcoinNetworkVersion.mainnet.P2PKH:
            return constants_1.PoXAddressVersion.P2PKH;
        case constants_1.BitcoinNetworkVersion.testnet.P2PKH:
            return constants_1.PoXAddressVersion.P2PKH;
        case constants_1.BitcoinNetworkVersion.mainnet.P2SH:
            return constants_1.PoXAddressVersion.P2SH;
        case constants_1.BitcoinNetworkVersion.testnet.P2SH:
            return constants_1.PoXAddressVersion.P2SH;
        default:
            throw new Error('Invalid pox address version');
    }
}
exports.btcAddressVersionToLegacyHashMode = btcAddressVersionToLegacyHashMode;
function nativeAddressToSegwitVersion(witnessVersion, dataLength) {
    if (witnessVersion === constants_1.SEGWIT_V0 && dataLength === 20)
        return constants_1.PoXAddressVersion.P2WPKH;
    if (witnessVersion === constants_1.SEGWIT_V0 && dataLength === 32)
        return constants_1.PoXAddressVersion.P2WSH;
    if (witnessVersion === constants_1.SEGWIT_V1 && dataLength === 32)
        return constants_1.PoXAddressVersion.P2TR;
    throw new Error('Invalid native segwit witness version and byte length. Currently, only P2WPKH, P2WSH, and P2TR are supported.');
}
function bech32Decode(btcAddress) {
    const { words: bech32Words } = base_1.bech32.decode(btcAddress);
    const witnessVersion = bech32Words[0];
    if (witnessVersion > 0)
        throw new Error('Addresses with a witness version >= 1 should be encoded in bech32m');
    return {
        witnessVersion,
        data: base_1.bech32.fromWords(bech32Words.slice(1)),
    };
}
function bech32MDecode(btcAddress) {
    const { words: bech32MWords } = base_1.bech32m.decode(btcAddress);
    const witnessVersion = bech32MWords[0];
    if (witnessVersion == 0)
        throw new Error('Addresses with witness version 1 should be encoded in bech32');
    return {
        witnessVersion,
        data: base_1.bech32m.fromWords(bech32MWords.slice(1)),
    };
}
function decodeNativeSegwitBtcAddress(btcAddress) {
    if (constants_1.SEGWIT_V0_ADDR_PREFIX.test(btcAddress))
        return bech32Decode(btcAddress);
    if (constants_1.SEGWIT_V1_ADDR_PREFIX.test(btcAddress))
        return bech32MDecode(btcAddress);
    throw new Error(`Native segwit address ${btcAddress} does not match valid prefix ${constants_1.SEGWIT_V0_ADDR_PREFIX} or ${constants_1.SEGWIT_V1_ADDR_PREFIX}`);
}
function decodeBtcAddress(btcAddress) {
    try {
        if (constants_1.B58_ADDR_PREFIXES.test(btcAddress)) {
            const b58 = (0, encryption_1.base58CheckDecode)(btcAddress);
            const addressVersion = btcAddressVersionToLegacyHashMode(b58.version);
            return {
                version: addressVersion,
                data: b58.hash,
            };
        }
        else if (constants_1.SEGWIT_ADDR_PREFIXES.test(btcAddress)) {
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
exports.decodeBtcAddress = decodeBtcAddress;
function extractPoxAddressFromClarityValue(poxAddrClarityValue) {
    const clarityValue = poxAddrClarityValue;
    if (clarityValue.type !== transactions_1.ClarityType.Tuple || !clarityValue.data) {
        throw new Error('Invalid argument, expected ClarityValue to be a TupleCV');
    }
    if (!('version' in clarityValue.data) || !('hashbytes' in clarityValue.data)) {
        throw new Error('Invalid argument, expected Clarity tuple value to contain `version` and `hashbytes` keys');
    }
    const versionCV = clarityValue.data['version'];
    const hashBytesCV = clarityValue.data['hashbytes'];
    if (versionCV.type !== transactions_1.ClarityType.Buffer || hashBytesCV.type !== transactions_1.ClarityType.Buffer) {
        throw new Error('Invalid argument, expected Clarity tuple value to contain `version` and `hashbytes` buffers');
    }
    return {
        version: versionCV.buffer[0],
        hashBytes: hashBytesCV.buffer,
    };
}
exports.extractPoxAddressFromClarityValue = extractPoxAddressFromClarityValue;
function getErrorString(error) {
    switch (error) {
        case constants_1.StackingErrors.ERR_STACKING_UNREACHABLE:
            return 'Stacking unreachable';
        case constants_1.StackingErrors.ERR_STACKING_CORRUPTED_STATE:
            return 'Stacking state is corrupted';
        case constants_1.StackingErrors.ERR_STACKING_INSUFFICIENT_FUNDS:
            return 'Insufficient funds';
        case constants_1.StackingErrors.ERR_STACKING_INVALID_LOCK_PERIOD:
            return 'Invalid lock period';
        case constants_1.StackingErrors.ERR_STACKING_ALREADY_STACKED:
            return 'Account already stacked. Concurrent stacking not allowed.';
        case constants_1.StackingErrors.ERR_STACKING_NO_SUCH_PRINCIPAL:
            return 'Principal does not exist';
        case constants_1.StackingErrors.ERR_STACKING_EXPIRED:
            return 'Stacking expired';
        case constants_1.StackingErrors.ERR_STACKING_STX_LOCKED:
            return 'STX balance is locked';
        case constants_1.StackingErrors.ERR_STACKING_PERMISSION_DENIED:
            return 'Permission denied';
        case constants_1.StackingErrors.ERR_STACKING_THRESHOLD_NOT_MET:
            return 'Stacking threshold not met';
        case constants_1.StackingErrors.ERR_STACKING_POX_ADDRESS_IN_USE:
            return 'PoX address already in use';
        case constants_1.StackingErrors.ERR_STACKING_INVALID_POX_ADDRESS:
            return 'Invalid PoX address';
        case constants_1.StackingErrors.ERR_STACKING_ALREADY_REJECTED:
            return 'Stacking already rejected';
        case constants_1.StackingErrors.ERR_STACKING_INVALID_AMOUNT:
            return 'Invalid amount';
        case constants_1.StackingErrors.ERR_NOT_ALLOWED:
            return 'Stacking not allowed';
        case constants_1.StackingErrors.ERR_STACKING_ALREADY_DELEGATED:
            return 'Already delegated';
        case constants_1.StackingErrors.ERR_DELEGATION_EXPIRES_DURING_LOCK:
            return 'Delegation expires during lock period';
        case constants_1.StackingErrors.ERR_DELEGATION_TOO_MUCH_LOCKED:
            return 'Delegation too much locked';
        case constants_1.StackingErrors.ERR_DELEGATION_POX_ADDR_REQUIRED:
            return 'PoX address required for delegation';
        case constants_1.StackingErrors.ERR_INVALID_START_BURN_HEIGHT:
            return 'Invalid start burn height';
        case constants_1.StackingErrors.ERR_NOT_CURRENT_STACKER:
            return 'ERR_NOT_CURRENT_STACKER';
        case constants_1.StackingErrors.ERR_STACK_EXTEND_NOT_LOCKED:
            return 'Stacker must be currently locked';
        case constants_1.StackingErrors.ERR_STACK_INCREASE_NOT_LOCKED:
            return 'Stacker must be currently locked';
        case constants_1.StackingErrors.ERR_DELEGATION_NO_REWARD_SLOT:
            return 'Invalid reward-cycle and reward-cycle-index';
        case constants_1.StackingErrors.ERR_DELEGATION_WRONG_REWARD_SLOT:
            return 'PoX address must match the one on record';
        case constants_1.StackingErrors.ERR_STACKING_IS_DELEGATED:
            return 'Stacker must be directly stacking and not delegating';
        case constants_1.StackingErrors.ERR_STACKING_NOT_DELEGATED:
            return 'Stacker must be delegating and not be directly stacking';
    }
}
exports.getErrorString = getErrorString;
function poxAddressToTuple(poxAddress) {
    const { version, data } = decodeBtcAddress(poxAddress);
    const versionBuff = (0, transactions_1.bufferCV)((0, common_1.bigIntToBytes)(BigInt(version), 1));
    const hashBuff = (0, transactions_1.bufferCV)(data);
    return (0, transactions_1.tupleCV)({
        version: versionBuff,
        hashbytes: hashBuff,
    });
}
exports.poxAddressToTuple = poxAddressToTuple;
function legacyHashModeToBtcAddressVersion(hashMode, network) {
    switch (hashMode) {
        case constants_1.PoXAddressVersion.P2PKH:
            return constants_1.BitcoinNetworkVersion[network].P2PKH;
        case constants_1.PoXAddressVersion.P2SH:
        case constants_1.PoXAddressVersion.P2SHP2WPKH:
        case constants_1.PoXAddressVersion.P2SHP2WSH:
            return constants_1.BitcoinNetworkVersion[network].P2SH;
        default:
            throw new Error('Invalid pox address version');
    }
}
function _poxAddressToBtcAddress_Values(version, hashBytes, network) {
    if (!network_1.StacksNetworks.includes(network))
        throw new Error('Invalid network.');
    switch (version) {
        case constants_1.PoXAddressVersion.P2PKH:
        case constants_1.PoXAddressVersion.P2SH:
        case constants_1.PoXAddressVersion.P2SHP2WPKH:
        case constants_1.PoXAddressVersion.P2SHP2WSH: {
            const btcAddrVersion = legacyHashModeToBtcAddressVersion(version, network);
            return (0, encryption_1.base58CheckEncode)(btcAddrVersion, hashBytes);
        }
        case constants_1.PoXAddressVersion.P2WPKH:
        case constants_1.PoXAddressVersion.P2WSH: {
            const words = base_1.bech32.toWords(hashBytes);
            return base_1.bech32.encode(constants_1.SegwitPrefix[network], [constants_1.SEGWIT_V0, ...words]);
        }
        case constants_1.PoXAddressVersion.P2TR: {
            const words = base_1.bech32m.toWords(hashBytes);
            return base_1.bech32m.encode(constants_1.SegwitPrefix[network], [constants_1.SEGWIT_V1, ...words]);
        }
    }
    throw new Error(`Unexpected address version: ${version}`);
}
function _poxAddressToBtcAddress_ClarityValue(poxAddrClarityValue, network) {
    const poxAddr = extractPoxAddressFromClarityValue(poxAddrClarityValue);
    return _poxAddressToBtcAddress_Values(poxAddr.version, poxAddr.hashBytes, network);
}
function poxAddressToBtcAddress(...args) {
    if (typeof args[0] === 'number')
        return _poxAddressToBtcAddress_Values(args[0], args[1], args[2]);
    return _poxAddressToBtcAddress_ClarityValue(args[0], args[1]);
}
exports.poxAddressToBtcAddress = poxAddressToBtcAddress;
function unwrap(optional) {
    if (optional.type === transactions_1.ClarityType.OptionalSome)
        return optional.value;
    if (optional.type === transactions_1.ClarityType.OptionalNone)
        return undefined;
    throw new Error("Object is not an 'Optional'");
}
exports.unwrap = unwrap;
function unwrapMap(optional, map) {
    if (optional.type === transactions_1.ClarityType.OptionalSome)
        return map(optional.value);
    if (optional.type === transactions_1.ClarityType.OptionalNone)
        return undefined;
    throw new Error("Object is not an 'Optional'");
}
exports.unwrapMap = unwrapMap;
function ensurePox2Activated(operationInfo) {
    if (operationInfo.period === constants_1.PoxOperationPeriod.Period1)
        throw new Error(`PoX-2 has not activated yet (currently in period ${operationInfo.period} of PoX-2 operation)`);
}
exports.ensurePox2Activated = ensurePox2Activated;
function ensureLegacyBtcAddressForPox1({ contract, poxAddress, }) {
    if (!poxAddress)
        return;
    if (contract.endsWith('.pox') && !constants_1.B58_ADDR_PREFIXES.test(poxAddress)) {
        throw new Error('PoX-1 requires P2PKH/P2SH/P2SH-P2WPKH/P2SH-P2WSH bitcoin addresses');
    }
}
exports.ensureLegacyBtcAddressForPox1 = ensureLegacyBtcAddressForPox1;
//# sourceMappingURL=utils.js.map