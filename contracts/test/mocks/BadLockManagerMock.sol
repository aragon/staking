pragma solidity 0.4.24;

import "../../ILockManager.sol";
import "../../Staking.sol";


contract BadLockManagerMock is ILockManager {
    function receiveLock(uint256, uint256, bytes) external returns (bool) {
        return false;
    }

    function canUnlock(address, uint256) external view returns (bool) {
        return true;
    }
}
