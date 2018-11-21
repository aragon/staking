pragma solidity 0.4.24;

import "../Staking.sol";
import "./mocks/NoApproveTokenMock.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract EchidnaStaking is Staking {
    using SafeMath for uint256;

    constructor() public {
        stakingToken = new NoApproveTokenMock(msg.sender, 10 ** 24);
    }

    // check that staked amount for an account is always >= total locked
    function echidna_account_stake_locks() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];

        uint256 totalLocks;
        for(uint256 i = 0; i < account.activeLockIds.length; i++) {
            totalLocks = totalLocks.add(account.locks[account.activeLockIds[i]].amount);
        }

        if (totalStakedFor(_account) < totalLocks) {
            return false;
        }

        return true;
    }

    // TODO: delete. Fake test to check that previous echidna test works
    function echidna_account_stake_locks_fake() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];

        uint256 totalLocks;
        for(uint256 i = 0; i < account.activeLockIds.length; i++) {
            totalLocks = totalLocks.add(account.locks[account.activeLockIds[i]].amount);
        }

        if (totalStakedFor(_account) > totalLocks) {
            return false;
        }

        return true;
    }

    // Check that all locks in activeLockIds array are indeed active (not unlocked)
    function echidna_active_locks() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];
        for(uint256 i = 0; i < account.activeLockIds.length; i++) {
            if (account.locks[account.activeLockIds[i]].unlockedAt < getTimestamp64()) {
                return false;
            }
        }

        return true;
    }

    // TODO: delete. Fake test to check that previous echidna test works
    function echidna_active_locks_fake() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];
        for(uint256 i = 0; i < account.activeLockIds.length; i++) {
            if (account.locks[account.activeLockIds[i]].unlockedAt >= getTimestamp64()) {
                return false;
            }
        }

        return true;
    }

    // Check that an unlocked lock is always in activeLockIds array
    function echidna_unlocked_locks() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];
        uint256 _lockId = 1;

        bool isUnlocked = account.locks[_lockId].unlockedAt < getTimestamp64();
        bool isInActiveLocksArray;
        for(uint256 i = 0; i < account.activeLockIds.length; i++) {
            if (account.activeLockIds[i] == _lockId) {
                isInActiveLocksArray = true;
                break;
            }
        }

        return !isUnlocked || isInActiveLocksArray;
    }

    // check that lockId zero is always empty
    function echidna_lockid_zero_empty() external view returns (bool) {
        if (accounts[msg.sender].locks[0].amount > 0) {
            return false;
        }

        if (accounts[msg.sender].locks[0].unlockedAt > 0) {
            return false;
        }

        if (address(accounts[msg.sender].locks[0].manager) != address(0)) {
            return false;
        }

        return true;
    }

}
