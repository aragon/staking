pragma solidity 0.4.24;

import "../../ILockManager.sol";
import "../../Staking.sol";


contract LockManagerMock is ILockManager {
    bool result;

    function transferFromLock(
        Staking _staking,
        address _from,
        uint256 _fromLockId,
        address _to,
        uint256 _toLockId,
        uint256 _amount
    )
        external
    {
        _staking.transferFromLock(_from, _fromLockId, _to, _toLockId, _amount);
    }

    function decreaseLockAmount(Staking _staking, address _account, uint256 _lockId, uint256 _newAmount) external {
        _staking.decreaseLockAmount(_account, _lockId, _newAmount);
    }

    function setLockManager(Staking _staking, address _account, uint256 _lockId, ILockManager _newManager) external {
        _staking.setLockManager(_account, _lockId, _newManager);
    }

    function canUnlock(address, uint256, bytes) external view returns (bool) {
        return result;
    }

    function setResult(bool _result) public {
        result = _result;
    }

    function unlock(Staking _staking, address _account, uint256 _lockId) public {
        _staking.unlock(_account, _lockId);
    }
}
