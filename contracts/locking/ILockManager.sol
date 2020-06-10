pragma solidity ^0.4.24;


interface ILockManager {
    /**
     * @notice Callback called from Staking when a new lock manager instance of this contract is allowed
     * @param _amount The amount of tokens to be locked
     * @param _allowance Amount of tokens that the manager can lock
     * @param _data Data to parametrize logic for the lock to be enforced by the manager
     */
    function receiveLock(uint256 _amount, uint256 _allowance, bytes _data) external returns (bool);

    /**
     * @notice Check if `_user`'s by `_lockManager` can be unlocked
     * @param _user Owner of lock
     * @param _amount Amount of locked tokens to unlock
     * @return Whether given lock of given owner can be unlocked by given sender
     */
    function canUnlock(address _user, uint256 _amount) external view returns (bool);
}
