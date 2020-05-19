pragma solidity 0.4.24;

import "../ILockManager.sol";
import "../IStakingLocking.sol";

import "@aragon/os/contracts/common/TimeHelpers.sol";
import "@aragon/os/contracts/evmscript/ScriptHelpers.sol";


contract TimeLockManager is ILockManager, TimeHelpers {
    using ScriptHelpers for bytes;

    string private constant ERROR_ALREADY_LOCKED = "TLM_ALREADY_LOCKED";
    string private constant ERROR_WRONG_INTERVAL = "TLM_WRONG_INTERVAL";

    enum TimeUnit { Blocks, Seconds }

    struct TimeInterval {
        uint256 unit;
        uint256 start;
        uint256 end;
    }
    mapping (address => TimeInterval) timeIntervals;

    function lock(IStakingLocking _staking, address _owner, uint256 _amount, uint256 _unit, uint256 _start, uint256 _end) external {
        require(timeIntervals[_owner].end == 0, ERROR_ALREADY_LOCKED);
        require(_end > _start, ERROR_WRONG_INTERVAL);
        timeIntervals[_owner] = TimeInterval(_unit, _start, _end);

        _staking.increaseLockAmount(_owner, address(this), _amount);
    }

    function canUnlock(address _owner, uint256) external view returns (bool) {
        TimeInterval storage timeInterval = timeIntervals[_owner];
        uint256 comparingValue;
        if (timeInterval.unit == uint256(TimeUnit.Blocks)) {
            comparingValue = getBlockNumber();
        } else {
            comparingValue = getTimestamp();
        }

        return comparingValue < timeInterval.start || comparingValue > timeInterval.end;
    }
}
