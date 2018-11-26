pragma solidity 0.4.24;

import "./ERCStaking.sol";
import "./ILockManager.sol";
import "./Checkpointing.sol";

import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/common/TimeHelpers.sol";

/* TODO:
   - function headers
   - order functions?
*/


contract Staking is ERCStaking, ERCStakingHistory, TimeHelpers {
    using SafeMath for uint256;
    using Checkpointing for Checkpointing.History;

    uint64 private constant MAX_UINT64 = uint64(-1);

    string private constant ERROR_NO_LOCK_MANAGER = "STAKING_NO_LOCK_MANAGER";
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

    modifier isLockManager(address _account, uint256 _lockId) {
        require(
            msg.sender == address(accounts[_account].locks[_lockId].manager),
            ERROR_NO_LOCK_MANAGER
        );
        _;
    }

    /**/
    constructor(ERC20 _stakingToken) public {
        stakingToken = _stakingToken;
    }
    /**/

    function stake(uint256 _amount, bytes _data) external {
        _stakeFor(msg.sender, _amount, _data);
    }

    function stakeFor(address _account, uint256 _amount, bytes _data) external {
        _stakeFor(_account, _amount, _data);
    }

    function unstake(uint256 _amount, bytes _data) external {
        // unstake 0 tokens makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        _modifyStakeBalance(msg.sender, _amount, false);

        // transfer tokens
        require(stakingToken.transfer(msg.sender, _amount), ERROR_TOKEN_TRANSFER);

        // Update history
        _updateTotalStaked();

        emit Unstaked(msg.sender, _amount, totalStakedFor(msg.sender), _data);
    }

    function totalStakedFor(address _account) public view returns (uint256) {
        return totalStakedForAt(_account, getBlockNumber64());
    }

    function totalStaked() external view returns (uint256) {
        return totalStakedAt(getBlockNumber64());
    }

    function token() external view returns (address) {
        return address(stakingToken);
    }

    // History
    function supportsHistory() external pure returns (bool) {
        return true;
    }

    function lastStakedFor(address _account) external view returns (uint256) {
        return stakeHistory[_account].lastUpdated();
    }

    function totalStakedForAt(address _account, uint256 _blockNumber) public view returns (uint256) {
        return stakeHistory[_account].get(_blockNumber);
    }

    function totalStakedAt(uint256 _blockNumber) public view returns (uint256) {
        return totalStakedHistory.get(_blockNumber);
    }

    // Lock
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

    function unlockAll(address _account) external {
        Account storage account = accounts[_account];

        for (uint256 i = account.activeLockIds.length; i > 0; i--) {
            if (canUnlock(_account, account.activeLockIds[i - 1])) {
                unlock(_account, account.activeLockIds[i - 1]);
            }
        }
    }

    function unlockAllOrNone(address _account) external {
        Account storage account = accounts[_account];

        for (uint256 i = account.activeLockIds.length; i > 0; i--) {
            unlock(_account, account.activeLockIds[i - 1]);
        }
    }

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
    }

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
        // origin must be a valid lockId
        require(_lockId > 0, ERROR_INVALID_LOCK_ID);
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

    }

    function _updateActiveLockAmount(address _account, uint256 _lockId, uint256 _amount, bool _increase) internal {
        Lock storage _lock = accounts[_account].locks[_lockId];
        // check that lock hasn't been unlocked
        require(_lock.unlockedAt > getTimestamp64(), ERROR_UNLOCKED_LOCK);
        /* TODO: this shouldn't be needed
        // check that lock is in active array
        bool activeLock;
        Account storage account = accounts[_account];
        for(uint256 i = 0; i < account.activeLockIds; i++) {
            if (account.activeLockIds[i] == _lockId) {
                activeLock = true;
                break;
            }
        }
        require(activeLock, ERROR_INACTIVE_LOCK);
        */
        _lock.amount = _increase ? _lock.amount.add(_amount) : _lock.amount.sub(_amount);
    }

    function setLockAmount(address _account, uint256 _lockId, uint256 _newAmount) external isLockManager(_account, _lockId) {
        // lock 0 tokens makes no sense
        require(_newAmount > 0, ERROR_AMOUNT_ZERO);

        // manager can only decrease locked amount
        Lock storage _lock = accounts[_account].locks[_lockId];
        require(_newAmount < _lock.amount, ERROR_INCREASING_LOCK_AMOUNT);

        _lock.amount = _newAmount;
        emit LockAmountChanged(_account, _lockId, _newAmount);
    }

    function setLockManager(address _account, uint256 _lockId, ILockManager _newManager) external isLockManager(_account, _lockId) {
        accounts[_account].locks[_lockId].manager = _newManager;
        emit LockManagerChanged(_account, _lockId, _newManager);
    }

    function setLockData(address _account, uint256 _lockId, bytes _newData) external isLockManager(_account, _lockId) {
        accounts[_account].locks[_lockId].data = _newData;
        emit LockDataChanged(_account, _lockId, _newData);
    }

    function unlockedBalanceOf(address _account) public view returns (uint256) {
        uint256 unlockedTokens = totalStakedFor(_account);

        Account storage account = accounts[_account];
        for (uint256 i = 0; i < account.activeLockIds.length; i++) {
            unlockedTokens = unlockedTokens.sub(account.locks[account.activeLockIds[i]].amount);
        }

        return unlockedTokens;
    }

    function locksCount(address acct) external view returns (uint256) {
        return accounts[acct].activeLockIds.length;
    }

    function canUnlock(address _account, uint256 _lockId) public view returns (bool) {
        Lock storage _lock = accounts[_account].locks[_lockId];

        if (msg.sender == address(_lock.manager) ||
           (msg.sender == _account && _lock.manager.canUnlock(_account, _lockId, _lock.data))) {
            return true;
        }

        return false;
    }

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

    /*
    function multicall(bytes[] _calls) public {
        for(uint i = 0; i < _calls.length; i++) {
            require(address(this).delegatecall(_calls[i]), ERROR_MULTICALL_DELEGATECALL);
        }
    }
    */

    function _stakeFor(address _account, uint256 _amount, bytes _data) internal {
        // stake 0 tokens makes no sense
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // process Stake
        _modifyStakeBalance(_account, _amount, true);

        // transfer tokens
        require(stakingToken.transferFrom(msg.sender, this, _amount), ERROR_TOKEN_TRANSFER);

        // Update history
        _updateTotalStaked();

        emit Staked(_account, _amount, totalStakedFor(_account), _data);
    }

    function _updateTotalStaked() internal {
        totalStakedHistory.add(getBlockNumber64(), stakingToken.balanceOf(this));
    }

    function _modifyStakeBalance(address _account, uint256 _by, bool _increase) internal {
        uint256 currentStake = totalStakedFor(_account);

        uint256 newStake = _increase ? currentStake.add(_by) : currentStake.sub(_by);

        _setStakedFor(_account, newStake);
    }

    function _setStakedFor(address _account, uint256 _amount) internal {
        stakeHistory[_account].add(getBlockNumber64(), _amount);
    }
}
