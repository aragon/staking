pragma solidity ^0.4.24;


interface ILockManager {
    function receiveLock(uint256 _amount, uint256 _allowance, bytes _data) external returns (bool);
    function canUnlock(address account, uint256 amount) external view returns (bool);
}
