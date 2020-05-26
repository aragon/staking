pragma solidity 0.4.24;

import "../../ILockManager.sol";
import "../../Staking.sol";


contract LockManagerMock is ILockManager {
    bool result;

    function transferFromLock(
        Staking _staking,
        address _from,
        address _to,
        address _toManager,
        uint256 _amount
    )
        external
    {
        _staking.transferFromLock(_from, _to, _toManager, _amount);
    }

    function decreaseLockAmount(Staking _staking, address _account, uint256 _newAmount) external {
        _staking.decreaseLockAmount(_account, address(this), _newAmount);
    }

    function setLockManager(Staking _staking, address _account, ILockManager _newManager) external {
        _staking.setLockManager(_account, _newManager);
    }

    function canUnlock(address, uint256) external view returns (bool) {
        return result;
    }

    function setResult(bool _result) public {
        result = _result;
    }

    function unlock(Staking _staking, address _account, address _manager) public {
        _staking.decreaseAndRemoveManager(_account, _manager);
    }
}
