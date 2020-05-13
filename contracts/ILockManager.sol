pragma solidity ^0.4.24;


interface ILockManager {
    function canUnlock(address account, bytes lockData) external view returns (bool);
}
