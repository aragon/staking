pragma solidity ^0.4.24;


interface IStakingLocking {
    event Locked(address indexed account, address indexed lockManager, uint256 amount, bytes data);
    event Unlocked(address indexed account, address indexed lockManager, uint256 amount, bytes data);
    event LockAmountChanged(address indexed account, address indexed lockManager, uint256 amount, bool increase);
    event LockManagerChanged(address indexed account, address indexed oldLockManager, address newLockManager);
    event LockDataChanged(address indexed account, address indexed lockManager, bytes data);

    function lock(uint256 _amount, address _lockManager, bytes _data) external;
    function unlock(address _account, address _lockManager) external;
    function increaseLockAmount(address _lockManager, uint256 _amount) external;
    function decreaseLockAmount(address _account, address _lockManager, uint256 _amount) external;
    function setLockManager(address _account, address _newLockManager) external;
    function setLockData(address _account, bytes _newData) external;
    function transfer(address _to, address _toLockManager, uint256 _amount) external;
    function transferFromLock(address _account, address _to, address _toLockManager, uint256 _amount) external;

    function getLock(address _account, address _lockManager)
        external
        view
        returns (
            uint256 _amount,
            bytes _data
        );
    function unlockedBalanceOf(address _account) external view returns (uint256);
    function canUnlock(address _account, address _lockManager, uint256 _amount) external view returns (bool);
}
