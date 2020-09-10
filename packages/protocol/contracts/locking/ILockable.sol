pragma solidity ^0.5.17;


interface ILockable {
    event NewLockManager(address indexed user, address indexed lockManager, bytes data);
    event LockAmountChanged(address indexed user, address indexed lockManager, uint256 amount);
    event LockAllowanceChanged(address indexed user, address indexed lockManager, uint256 allowance);
    event LockManagerRemoved(address indexed user, address indexed lockManager);
    event LockManagerTransferred(address indexed user, address indexed oldLockManager, address indexed newLockManager);

    function allowManager(address _lockManager, uint256 _allowance, bytes calldata _data) external;
    function unlockAndRemoveManager(address _user, address _lockManager) external;
    function increaseLockAllowance(address _lockManager, uint256 _allowance) external;
    function decreaseLockAllowance(address _user, address _lockManager, uint256 _allowance) external;

    function lock(address _user, uint256 _amount) external;
    function unlock(address _user, address _lockManager, uint256 _amount) external;
    function slash(address _user, address _to, uint256 _amount) external;
    function slashAndUnstake(address _user, address _to, uint256 _amount) external;

    function getLock(address _user, address _lockManager) external view returns (uint256 _amount, uint256 _allowance);
    function unlockedBalanceOf(address _user) external view returns (uint256);
    function lockedBalanceOf(address _user) external view returns (uint256);
    function getBalancesOf(address _user) external view returns (uint256 staked, uint256 locked);
    function canUnlock(address _sender, address _user, address _lockManager, uint256 _amount) external view returns (bool);
}
