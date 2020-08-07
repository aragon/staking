pragma solidity 0.5.17;

import "../../locking/ILockManager.sol";
import "../../Staking.sol";


contract BadLockManagerMock is ILockManager {
    function canUnlock(address, uint256) external view returns (bool) {
        return true;
    }
}
