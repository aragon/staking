pragma solidity 0.4.24;

import "../ILockManager.sol";

import "@aragon/os/contracts/common/TimeHelpers.sol";
import "@aragon/os/contracts/evmscript/ScriptHelpers.sol";


contract TimeLockManager is ILockManager, TimeHelpers {
    using ScriptHelpers for bytes;

    enum TimeUnit { Blocks, Seconds }

    function canUnlock(address, bytes _lockData, uint256) external view returns (bool) {
        uint256 unit = _lockData.uint256At(0);
        uint256 start = _lockData.uint256At(32);
        uint256 end = _lockData.uint256At(64);
        uint256 comparingValue;
        if (unit == uint256(TimeUnit.Blocks)) {
            comparingValue = getBlockNumber();
        } else {
            comparingValue = getTimestamp();
        }

        return comparingValue < start || comparingValue > end;
    }
}
