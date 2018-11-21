pragma solidity 0.4.24;

import "../../ILockManager.sol";
import "../../Staking.sol";


contract LockManagerMock is ILockManager {
    bool result;

    function setResult(bool _result) public {
        result = _result;
    }

    function unlock(Staking _staking, address _account, uint256 _lockId) public {
        _staking.unlock(_account, _lockId);
    }

    function transferFromLock(
        Staking _staking,
        address _account,
        uint256 _lockId,
        uint256 _amount,
        address _to,
        uint256 _toLockId
    )
        external
    {
        _staking.transferFromLock(_account, _lockId, _amount, _to, _toLockId);
    }

    function setLockAmount(Staking _staking, address _account, uint256 _lockId, uint256 _newAmount) external {
        _staking.setLockAmount(_account, _lockId, _newAmount);
    }

    function setLockManager(Staking _staking, address _account, uint256 _lockId, ILockManager _newManager) external {
        _staking.setLockManager(_account, _lockId, _newManager);
    }

    function canUnlock(address, uint256, bytes) external view returns (bool) {
        return result;
    }
}
