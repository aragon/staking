pragma solidity 0.4.24;

import "./ERCStaking.sol";
import "./ILockManager.sol";

import "./Checkpointing.sol";

import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/TimeHelpers.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";


contract Staking is ERCStaking, ERCStakingHistory, TimeHelpers, IsContract {
    using SafeMath for uint256;
    using Checkpointing for Checkpointing.History;

    uint64 private constant MAX_UINT64 = uint64(-1);

    string private constant ERROR_NOT_LOCK_MANAGER = "STAKING_NOT_LOCK_MANAGER";
    string private constant ERROR_AMOUNT_ZERO = "STAKING_AMOUNT_ZERO";
    string private constant ERROR_TOKEN_TRANSFER = "STAKING_TOKEN_TRANSFER";
    string private constant ERROR_NOT_ENOUGH_BALANCE = "STAKING_NOT_ENOUGH_BALANCE";
    string private constant ERROR_CAN_NOT_UNLOCK = "STAKING_CAN_NOT_UNLOCKERROR_";
    string private constant ERROR_INVALID_LOCK_ID = "STAKING_INVALID_LOCK_ID";
    string private constant ERROR_NOT_ENOUGH_LOCK = "STAKING_NOT_ENOUGH_LOCKED_FUNDS";
    string private constant ERROR_UNLOCKED_LOCK = "STAKING_UNLOCKED_LOCK";
    string private constant ERROR_INCREASING_LOCK_AMOUNT = "STAKING_INCREASING_LOCK_AMOUNT";

    struct Lock {
        uint256 amount;
        uint64 unlockedAt;
        ILockManager manager; // can also be an EOA
        bytes data;
    }

    struct Account {
        uint256[] activeLockIds;
        uint256 lastLockId;
        mapping(uint256 => Lock) locks; // first valid lock starts at 1, so _toLockId = 0 means no lock
    }

    ERC20 stakingToken;
    mapping(address => Account) accounts;
    mapping (address => Checkpointing.History) stakeHistory;
    Checkpointing.History totalStakedHistory;

    event Staked(address indexed account, uint256 amount, uint256 total, bytes data);
    event Unstaked(address indexed account, uint256 amount, uint256 total, bytes data);
    event Locked(address indexed account, uint256 indexed lockId, uint256 amount, address manager, bytes data);
    event Unlocked(address indexed account, uint256 indexed lockId, uint256 amount, address manager, bytes data);
    event LockAmountChanged(address indexed account, uint256 indexed lockId, uint256 amount);
    event LockManagerChanged(address indexed account, uint256 indexed lockId, address manager);
    event LockDataChanged(address indexed account, uint256 indexed lockId, bytes data);
    event Transferred(address indexed from, uint256 indexed fromLockId, uint256 amount, address to, uint256 toLockId);

    modifier isLockManager(address _account, uint256 _lockId) {
        require(
            msg.sender == address(accounts[_account].locks[_lockId].manager),
            ERROR_NOT_LOCK_MANAGER
        );
        _;
    }

    constructor(ERC20 _stakingToken) public {
        require(isContract(_stakingToken));
        stakingToken = _stakingToken;
    }

    /* External functions */

    /**
     * @notice Stakes `_amount` tokens, transferring them from caller
     * @param _amount Number of tokens staked
     * @param _data Used in Staked event, to add signalling information in more complex staking applications
     */
    function stake(uint256 _amount, bytes _data) external {
        _stakeFor(msg.sender, _amount, _data);
    }

    /**
     * @notice Stakes `_amount` tokens, transferring them from caller, and assigns them to `_account`
     * @param _account The final staker of the tokens
     * @param _amount Number of tokens staked
     * @param _data Used in Staked event, to add signalling information in more complex staking applications
     */
    function stakeFor(address _account, uint256 _amount, bytes _data) external {
        _stakeFor(_account, _amount, _data);
    }

    /**
     * @notice Unstakes `_amount` tokens, returning them to the user
     * @param _amount Number of tokens staked
     * @param _data Used in Unstaked event, to add signalling information in more complex staking applications
     */
    function unstake(uint256 _amount, bytes _data) external {
        // unstake 0 tokens makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // transfer tokens
        require(stakingToken.transfer(msg.sender, _amount), ERROR_TOKEN_TRANSFER);

        // process Stake
        _modifyStakeBalance(msg.sender, _amount, false);

        // Update history
        _updateTotalStaked();

        emit Unstaked(msg.sender, _amount, totalStakedFor(msg.sender), _data);
    }

    /**
     * @notice Get the total amount of tokens staked by all users
     * @return The total amount of tokens staked by all users
     */
    function totalStaked() external view returns (uint256) {
        return totalStakedAt(getBlockNumber64());
    }

    /**
     * @notice Get the token used by the contract for staking and locking
     * @return The token used by the contract for staking and locking
     */
    function token() external view returns (address) {
        return address(stakingToken);
    }

    /**
     * @notice Check whether it supports history of stakes
     * @return Always true
     */
    function supportsHistory() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Get last time `_account` modified its staked balance
     * @param _account Account requesting for
     * @return Last block number when account's balance was modified
     */
    function lastStakedFor(address _account) external view returns (uint256) {
        return stakeHistory[_account].lastUpdated();
    }

    /**
     * @notice Lock `_amount` staked tokens and assign `_manager` as manager with `_data` as data, so they can not be unstaked
     * @param _amount The amount of tokens to be locked
     * @param _manager The manager entity for this particular lock. This entity will have full control over the lock, in particular will be able to unlock it
     * @param _data Data to parametrize logic for the lock to be enforced by the manager
     * @return The id of the newly created lock
     */
    function lock(uint256 _amount, address _manager, bytes _data) external returns (uint256 _lockId) {
        // lock 0 tokens makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // check enough unlocked tokens are available
        require(_amount <= unlockedBalanceOf(msg.sender), ERROR_NOT_ENOUGH_BALANCE);

        accounts[msg.sender].lastLockId++;
        _lockId = accounts[msg.sender].lastLockId;
        accounts[msg.sender].activeLockIds.push(_lockId);
        Lock storage _lock = accounts[msg.sender].locks[_lockId];
        _lock.amount = _amount;
        _lock.unlockedAt = MAX_UINT64;
        _lock.manager = ILockManager(_manager);
        _lock.data = _data;

        emit Locked(msg.sender, _lockId, _amount, _manager, _data);
    }

    /**
     * @notice Try to unlock as much locks belonging to `_account` as possible
     * @param _account Owner whose locks are to be unlocked
     */
    function unlockAll(address _account) external {
        Account storage account = accounts[_account];

        for (uint256 i = account.activeLockIds.length; i > 0; i--) {
            if (canUnlock(_account, account.activeLockIds[i - 1])) {
                unlock(_account, account.activeLockIds[i - 1]);
            }
        }
    }

    /**
     * @notice Try to unlock all locks belonging to `_account` and revert if any of them fail
     * @param _account Owner whose locks are to be unlocked
     */
    function unlockAllOrNone(address _account) external {
        Account storage account = accounts[_account];

        for (uint256 i = account.activeLockIds.length; i > 0; i--) {
            unlock(_account, account.activeLockIds[i - 1]);
        }
    }

    /**
     * @notice Transfer `_amount` tokens to `_to``_toLockId > 0 ? '\'s lock #' + _toLockId : ''`
     * @param _amount Number of tokens to be transferred
     * @param _to Recipient of the tokens
     * @param _toLockId Lock id of the recipient to add the tokens to, if any
     */
    function transfer(uint256 _amount, address _to, uint256 _toLockId) external {
        // amount zero makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);
        // have enough unlocked funds
        require(_amount <= unlockedBalanceOf(msg.sender), ERROR_NOT_ENOUGH_BALANCE);

        if (_toLockId > 0) {
            _updateActiveLockAmount(_to, _toLockId, _amount, true);
        }

        // update stakes
        _modifyStakeBalance(msg.sender, _amount, false);
        _modifyStakeBalance(_to, _amount, true);

        emit Transferred(msg.sender, 0, _amount, _to, _toLockId);
    }

    /**
     * @notice Transfer `_amount` tokens from `_account`'s lock #`_lockId` to `_to``_toLockId > 0 ? '\'s lock #' + _toLockId : ''`
     * @param _account Owner of locked tokens
     * @param _lockId Id of the lock for the given account
     * @param _amount Number of tokens to be transferred
     * @param _to Recipient of the tokens
     * @param _toLockId Lock id of the recipient to add the tokens to, if any
     */
    function transferFromLock(
        address _account,
        uint256 _lockId,
        uint256 _amount,
        address _to,
        uint256 _toLockId
    )
        external
        isLockManager(_account, _lockId)
    {
        // No need to check that lockId > 0, as isLockManager would fail
        // amount zero makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);
        // have enough locked funds
        require(_amount <= accounts[_account].locks[_lockId].amount, ERROR_NOT_ENOUGH_LOCK);

        _updateActiveLockAmount(_account, _lockId, _amount, false);
        if (_toLockId > 0) {
            _updateActiveLockAmount(_to, _toLockId, _amount, true);
        }

        // update stakes
        _modifyStakeBalance(_account, _amount, false);
        _modifyStakeBalance(_to, _amount, true);

        emit Transferred(_account, _lockId, _amount, _to, _toLockId);
    }

    /**
     * @notice Decrease the amount of tokens locked in `_account`'s lock #`_lockId` to `_newAmount`
     * @param _account Owner of locked tokens
     * @param _lockId Id of the lock for the given account
     * @param _newAmount New amount of locked tokens
     */
    function setLockAmount(address _account, uint256 _lockId, uint256 _newAmount) external isLockManager(_account, _lockId) {
        // lock 0 tokens makes no sense
        require(_newAmount > 0, ERROR_AMOUNT_ZERO);

        // manager can only decrease locked amount
        Lock storage _lock = accounts[_account].locks[_lockId];
        require(_newAmount < _lock.amount, ERROR_INCREASING_LOCK_AMOUNT);

        _lock.amount = _newAmount;
        emit LockAmountChanged(_account, _lockId, _newAmount);
    }

    /**
     * @notice Change the manager of `_account`'s lock #`_lockId` to `_newManager`
     * @param _account Owner of lock
     * @param _lockId Id of the lock for the given account
     * @param _newManager New lock's manager
     */
    function setLockManager(address _account, uint256 _lockId, ILockManager _newManager) external isLockManager(_account, _lockId) {
        accounts[_account].locks[_lockId].manager = _newManager;
        emit LockManagerChanged(_account, _lockId, _newManager);
    }

    /**
     * @notice Change data of `_account`'s lock #`_lockId` to `_newData`
     * @param _account Owner of lock
     * @param _lockId Id of the lock for the given account
     * @param _newData New data containing logic to enforce the lock
     */
    function setLockData(address _account, uint256 _lockId, bytes _newData) external isLockManager(_account, _lockId) {
        accounts[_account].locks[_lockId].data = _newData;
        emit LockDataChanged(_account, _lockId, _newData);
    }

    /**
     * @notice Get the number of locks belonging to `_account`
     * @param _account Owner of locks
     * @return The number of locks belonging to the given account
     */
    function locksCount(address _account) external view returns (uint256) {
        return accounts[_account].activeLockIds.length;
    }

    /**
     * @notice Get details of `_account`'s lock #`_lockId`
     * @param _account Owner of lock
     * @param _lockId Id of the lock for the given account
     * @return Amount of locked tokens
     * @return Block number when the lock was released
     * @return Lock's manager
     * @return Lock's data
     */
    function getLock(address _account, uint256 _lockId)
        external
        view
        returns (
            uint256 _amount,
            uint64 _unlockedAt,
            address _manager,
            bytes _data
        )
    {
        Lock storage _lock = accounts[_account].locks[_lockId];
        _amount = _lock.amount;
        _unlockedAt = _lock.unlockedAt;
        _manager = _lock.manager;
        _data = _lock.data;
    }

    /* Public functions */

    /**
     * @notice Get the amount of tokens staked by `_account`
     * @param _account The owner of the tokens
     * @return The amount of tokens staked by the given account
     */
    function totalStakedFor(address _account) public view returns (uint256) {
        return totalStakedForAt(_account, getBlockNumber64());
    }

    /**
     * @notice Get the total amount of tokens staked by `_account` at block number `_blockNumber`
     * @param _account Account requesting for
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked by the account at the given block number
     */
    function totalStakedForAt(address _account, uint256 _blockNumber) public view returns (uint256) {
        return stakeHistory[_account].get(_blockNumber);
    }

    /**
     * @notice Get the total amount of tokens staked by all users at block number `_blockNumber`
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked at the given block number
     */
    function totalStakedAt(uint256 _blockNumber) public view returns (uint256) {
        return totalStakedHistory.get(_blockNumber);
    }

    /**
     * @notice Unlock `_account`'s lock #`_lockId` so locked tokens can be unstaked again
     * @param _account Owner of locked tokens
     * @param _lockId Id of the lock for the given account
     */
    function unlock(address _account, uint256 _lockId) public {
        Account storage account = accounts[_account];
        Lock storage _lock = account.locks[_lockId];

        // only manager and owner (if manager allows) can unlock
        require(canUnlock(_account, _lockId), ERROR_CAN_NOT_UNLOCK);

        _lock.unlockedAt = getTimestamp64();

        // remove from active locks, replacing it by the last one in the array
        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
            if (account.activeLockIds[i] == _lockId) {
                account.activeLockIds[i] = account.activeLockIds[account.activeLockIds.length - 1];
                delete(account.activeLockIds[account.activeLockIds.length - 1]);
                account.activeLockIds.length--;
                break;
            }
        }

        emit Unlocked(_account, _lockId, _lock.amount, _lock.manager, _lock.data);
    }

    /**
     * @notice Get the staked but not locked amount of tokens by `_account`
     * @param _account Owner of the staked but unlocked balance
     * @return Amount of tokens staked but not locked by given account
     */
    function unlockedBalanceOf(address _account) public view returns (uint256) {
        uint256 unlockedTokens = totalStakedFor(_account);

        Account storage account = accounts[_account];
        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
            unlockedTokens = unlockedTokens.sub(account.locks[account.activeLockIds[i]].amount);
        }

        return unlockedTokens;
    }

    /**
     * @notice Check if `_account`'s lock #`_lockId` can be unlocked
     * @param _account Owner of lock
     * @param _lockId Id of the lock for the given account
     * @return Whether given lock of given account can be unlocked
     */
    function canUnlock(address _account, uint256 _lockId) public view returns (bool) {
        Lock storage _lock = accounts[_account].locks[_lockId];

        if (msg.sender == address(_lock.manager) ||
            (msg.sender == _account && _lock.manager.canUnlock(_account, _lockId, _lock.data))) {
            return true;
        }

        return false;
    }

    /*
    function multicall(bytes[] _calls) public {
        for(uint i = 0; i < _calls.length; i++) {
            require(address(this).delegatecall(_calls[i]), ERROR_MULTICALL_DELEGATECALL);
        }
    }
    */

    /* Internal functions */

    function _updateActiveLockAmount(address _account, uint256 _lockId, uint256 _amount, bool _increase) internal {
        Lock storage _lock = accounts[_account].locks[_lockId];
        // check that lock hasn't been unlocked
        require(_lock.unlockedAt > getTimestamp64(), ERROR_UNLOCKED_LOCK);
        // checking that lock is in active array shouldn't be needed if data is consitent

        if (_increase) {
            _lock.amount = _lock.amount.add(_amount);
        } else {
            _lock.amount = _lock.amount.sub(_amount);
        }
    }

    function _stakeFor(address _account, uint256 _amount, bytes _data) internal {
        // stake 0 tokens makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // transfer tokens
        require(stakingToken.transferFrom(msg.sender, this, _amount), ERROR_TOKEN_TRANSFER);

        // process Stake
        _modifyStakeBalance(_account, _amount, true);

        // Update history
        _updateTotalStaked();

        emit Staked(_account, _amount, totalStakedFor(_account), _data);
    }

    function _modifyStakeBalance(address _account, uint256 _by, bool _increase) internal {
        uint256 currentStake = totalStakedFor(_account);

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            newStake = currentStake.sub(_by);
        }

        _setStakedFor(_account, newStake);
    }

    function _updateTotalStaked() internal {
        totalStakedHistory.add(getBlockNumber64(), stakingToken.balanceOf(this));
    }

    function _setStakedFor(address _account, uint256 _amount) internal {
        stakeHistory[_account].add(getBlockNumber64(), _amount);
    }
}
