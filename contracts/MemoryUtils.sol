pragma solidity 0.5.3;


/**
 * @title MemoryUtils
 * From: https://github.com/Arachnid/solidity-stringutils/blob/master/src/strings.sol
 */
library MemoryUtils {
    function copy(uint256 dest, uint256 src, uint256 length) internal pure {
        // Copy word-length chunks while possible
        for (; length >= 32; length -= 32) {
            assembly { mstore(dest, mload(src)) }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint256 mask = 256 ** (32 - length) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }
}
