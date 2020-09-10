pragma solidity >=0.5 <=0.7;


interface IStaking {
    // IERC-900
    function stake(uint256 _amount, bytes calldata _data) external;
    function stakeFor(address _user, uint256 _amount, bytes calldata _data) external;
    function unstake(uint256 _amount, bytes calldata _data) external;

    function totalStakedFor(address _addr) external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function token() external view returns (address);
    function supportsHistory() external pure returns (bool);

    function lastStakedFor(address addr) external view returns (uint256);
    function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);
    function totalStakedAt(uint256 blockNumber) external view returns (uint256);

    // ILockable
    function allowManager(address _lockManager, uint256 _allowance, bytes _data) external;
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

    // Misc.
    function transfer(address _to, uint256 _amount) external;
    function transferAndUnstake(address _to, uint256 _amount) external;
}
