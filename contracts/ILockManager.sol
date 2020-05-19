pragma solidity ^0.4.24;


interface ILockManager {
    function canUnlock(address account, uint256 amount) external view returns (bool);
}
