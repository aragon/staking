pragma solidity 0.4.24;

import "../Staking.sol";
import "./mocks/NoApproveTokenMock.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract EchidnaStaking is Staking {
    using SafeMath for uint256;

    constructor() public {
        stakingToken = ERC20(new NoApproveTokenMock(msg.sender, 10 ** 24));
    }

    // check that staked amount for an account is always >= total locked
    function echidna_account_stake_locks() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];

        if (_totalStakedFor(_account) < account.totalLocked) {
            return false;
        }

        return true;
    }

    // TODO: delete. Fake test to check that previous echidna test works
    function echidna_account_stake_locks_fake() external view returns (bool) {
        address _account = msg.sender;
        Account storage account = accounts[_account];

        if (_totalStakedFor(_account) > account.totalLocked) {
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
        if (_totalStaked() <= stakingToken.balanceOf(this)) {
            return true;
        }

        return false;
    }

    // sum of all account stakes should be equal to total staked and to staking token balance of staking contract, but it's hard to compute as accounts is a mapping
}
