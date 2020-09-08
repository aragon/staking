pragma solidity ^0.5.17;


// Note: seems weird that this is in the locking/ dir; perhaps we should move it up to be the same dir as Staking?
// Note: perhaps we can find a better name... like StakingWithLockManagement?
interface IStakingLocking {
    event NewLockManager(address indexed account, address indexed lockManager, bytes data);
    event Unlocked(address indexed account, address indexed lockManager, uint256 amount);
    // Note: the increase param for these two does not seem that useful
    event LockAmountChanged(address indexed account, address indexed lockManager, uint256 amount, bool increase);
    event LockAllowanceChanged(address indexed account, address indexed lockManager, uint256 allowance, bool increase);
    // Note: should the lock manager param be indexed?
    event LockManagerRemoved(address indexed account, address lockManager);
    // Note: should the new lock manager param be indexed?
    event LockManagerTransferred(address indexed account, address indexed oldLockManager, address newLockManager);
    // Note: should the to param be indexed?
    event StakeTransferred(address indexed from, address to, uint256 amount);

    function allowManager(address _lockManager, uint256 _allowance, bytes calldata _data) external;
    function allowManagerAndLock(uint256 _amount, address _lockManager, uint256 _allowance, bytes calldata _data) external;
    function unlockAndRemoveManager(address _account, address _lockManager) external;
    function increaseLockAllowance(address _lockManager, uint256 _allowance) external;
    function decreaseLockAllowance(address _account, address _lockManager, uint256 _allowance) external;

    // Note: should we prefer amount before the lock manager in the interface? The ones before have it before, the ones below have it after
    function lock(address _account, address _lockManager, uint256 _amount) external;
    function unlock(address _account, address _lockManager, uint256 _amount) external;
    function setLockManager(address _account, address _newLockManager) external;
    function transfer(address _to, uint256 _amount) external;
    function transferAndUnstake(address _to, uint256 _amount) external;
    function slash(address _account, address _to, uint256 _amount) external;
    function slashAndUnstake(address _account, address _to, uint256 _amount) external;

    function getLock(address _account, address _lockManager) external view returns (uint256 _amount, uint256 _allowance);
    function unlockedBalanceOf(address _account) external view returns (uint256);
    // Note: seems weird to use both 'user' and 'account' as names, if they represent the same concept
    function lockedBalanceOf(address _user) external view returns (uint256);
    function getBalancesOf(address _user) external view returns (uint256 staked, uint256 locked);
    function canUnlock(address _sender, address _account, address _lockManager, uint256 _amount) external view returns (bool);
}
