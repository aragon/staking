pragma solidity 0.4.24;

import "../Staking.sol";
import "./mocks/NoApproveTokenMock.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract EchidnaStaking is Staking {
    using SafeMath for uint256;

    constructor(ERC20) public Staking(ERC20(address(0))) {
        stakingToken = ERC20(new NoApproveTokenMock(msg.sender, 10 ** 24));
    }

    // check that staked amount for an account is always >= total locked
    function echidna_account_stake_locks() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];

        uint256 totalLocks;
        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
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
        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
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

        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
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

        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
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
        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
            if (account.activeLockIds[i] == _lockId) {
                isInActiveLocksArray = true;
                break;
            }
        }

        return !isUnlocked || isInActiveLocksArray;
    }

    // Check that all locks in activeLockIds array have positive amount
    function echidna_active_locks_amount() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];

        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
            if (account.locks[account.activeLockIds[i]].amount == 0) {
                return false;
            }
        }

        return true;
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

    // check that Checkpointing history arrays are ordered
    function echidna_global_history_is_ordered() external view returns (bool) {
        for (uint256 i = 1; i < totalStakedHistory.history.length; i++) {
            if (totalStakedHistory.history[i].time <= totalStakedHistory.history[i - 1].time) {
                return false;
            }
        }

        return true;
    }

    function echidna_user_history_is_ordered() external view returns (bool) {
        address account = msg.sender;
        for (uint256 i = 1; i < accounts[account].stakedHistory.history.length; i++) {
            if (accounts[account].stakedHistory.history[i].time <= accounts[account].stakedHistory.history[i - 1].time) {
                return false;
            }
        }

        return true;
    }

    // total staked matches less or equal than token balance
    function echidna_total_staked_is_balance() external view returns (bool) {
        if (totalStaked() <= stakingToken.balanceOf(this)) {
            return true;
        }

        return false;
    }

    // sum of all account stakes should be equal to total staked and to staking token balance of staking contract, but it's hard to compute as accounts is a mapping
}
