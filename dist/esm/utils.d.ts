import { BufferCV, ClarityValue, OptionalCV, TupleCV } from '@stacks/transactions';
import { PoXAddressVersion, StackingErrors } from './constants';
import { StacksNetworkName } from '@stacks/network';
export declare class InvalidAddressError extends Error {
    innerError?: Error;
    constructor(address: string, innerError?: Error);
}
export declare function btcAddressVersionToLegacyHashMode(btcAddressVersion: number): PoXAddressVersion;
export declare function decodeBtcAddress(btcAddress: string): {
    version: PoXAddressVersion;
    data: Uint8Array;
};
export declare function extractPoxAddressFromClarityValue(poxAddrClarityValue: ClarityValue): {
    version: number;
    hashBytes: Uint8Array;
};
export declare function getErrorString(error: StackingErrors): string;
export declare function poxAddressToTuple(poxAddress: string): TupleCV<{
    [key: string]: BufferCV;
}>;
export declare function poxAddressToBtcAddress(version: number, hashBytes: Uint8Array, network: StacksNetworkName): string;
export declare function poxAddressToBtcAddress(poxAddrClarityValue: ClarityValue, network: StacksNetworkName): string;
export declare function unwrap<T extends ClarityValue>(optional: OptionalCV<T>): T | undefined;
export declare function unwrapMap<T extends ClarityValue, U>(optional: OptionalCV<T>, map: (t: T) => U): U | undefined;
export declare function ensureLegacyBtcAddressForPox1({ contract, poxAddress, }: {
    contract: string;
    poxAddress?: string;
}): void;
