pragma solidity >=0.4 <=0.7;


interface ILockManager {
    /**
     * @notice Check if `_user`'s by `_lockManager` can be unlocked
     * @param _user Owner of lock
     * @param _amount Amount of locked tokens to unlock
     * @return Whether given lock of given owner can be unlocked by given sender
     */
    function canUnlock(address _user, uint256 _amount) external view returns (bool);
}
