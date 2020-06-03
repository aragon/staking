pragma solidity ^0.4.24;


interface IStakingLocking {
    event NewLockManager(address indexed account, address indexed lockManager, bytes data);
    event Unlocked(address indexed account, address indexed lockManager, uint256 amount);
    event LockAmountChanged(address indexed account, address indexed lockManager, uint256 amount, bool increase);
    event LockAllowanceChanged(address indexed account, address indexed lockManager, uint256 allowance, bool increase);
    event LockManagerChanged(address indexed account, address indexed oldLockManager, address newLockManager);
    event StakeTransferred(address indexed from, address indexed fromLockManager, uint256 amount, address to, address toLockManager);


    function allowNewLockManager(address _lockManager, uint256 _allowance, bytes _data) external;
    function allowManagerAndLock(uint256 _amount, address _lockManager, uint256 _allowance, bytes _data) external;
    function decreaseAndRemoveManager(address _account, address _lockManager) external;
    function increaseLockAllowance(address _lockManager, uint256 _allowance) external;
    function decreaseLockAllowance(address _account, address _lockManager, uint256 _allowance) external;
    function increaseLockAmount(address _account, address _lockManager, uint256 _amount) external;
    function decreaseLockAmount(address _account, address _lockManager, uint256 _amount) external;
    function setLockManager(address _account, address _newLockManager) external;
    function transfer(address _to, address _toLockManager, uint256 _amount) external;
    function transferFromLock(address _account, address _to, address _toLockManager, uint256 _amount) external;
    function transferFromLockAndUnstake(address _account, address _to, uint256 _amount) external;

    function getLock(address _account, address _lockManager)
        external
        view
        returns (
            uint256 _amount,
            uint256 _allowance
        );
    function unlockedBalanceOf(address _account) external view returns (uint256);
    function getTotalLockedOf(address _accountAddress) external view returns (uint256);
    function getBalancesOf(address _accountAddress) external view returns (uint256 staked, uint256 locked);
    function canUnlock(address _account, address _lockManager, uint256 _amount) external view returns (bool);
}
