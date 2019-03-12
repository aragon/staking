pragma solidity ^0.4.24;

import "./ILockManager.sol";


interface IStakingLocking {
    event Locked(address indexed account, uint256 indexed lockId, uint256 amount, address manager, bytes data);
    event Unlocked(address indexed account, uint256 indexed lockId, uint256 amount, address manager, bytes data);
    event LockAmountChanged(address indexed account, uint256 indexed lockId, uint256 amount);
    event LockManagerChanged(address indexed account, uint256 indexed lockId, address manager);
    event LockDataChanged(address indexed account, uint256 indexed lockId, bytes data);

    function lock(uint256 _amount, address _manager, bytes _data) external returns (uint256 _lockId);
    function unlock(address _account, uint256 _lockId) external;
    function setLockAmount(address _account, uint256 _lockId, uint256 _newAmount) external;
    function setLockManager(address _account, uint256 _lockId, ILockManager _newManager) external;
    function setLockData(address _account, uint256 _lockId, bytes _newData) external;
    function transfer(uint256 _amount, address _to, uint256 _toLockId) external;
    function transferFromLock(address _account, uint256 _lockId, uint256 _amount, address _to, uint256 _toLockId) external;

    function locksCount(address _account) external view returns (uint256);
    function getLock(address _account, uint256 _lockId)
        external
        view
        returns (
            uint256 _amount,
            uint64 _unlockedAt,
            address _manager,
            bytes _data
        );
    function unlockedBalanceOf(address _account) external view returns (uint256);
    function canUnlock(address _account, uint256 _lockId) external view returns (bool);
}
