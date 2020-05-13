pragma solidity 0.4.24;

import "./ERCStaking.sol";
import "./IStakingLocking.sol";
import "./ILockManager.sol";
import "./Checkpointing.sol";

import "@aragon/os/contracts/common/Autopetrified.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract Staking is Autopetrified, ERCStaking, ERCStakingHistory, IStakingLocking, IsContract {
    using SafeMath for uint256;
    using Checkpointing for Checkpointing.History;
    using SafeERC20 for ERC20;

    uint64 private constant MAX_UINT64 = uint64(-1);

    string private constant ERROR_TOKEN_NOT_CONTRACT = "STAKING_TOKEN_NOT_CONTRACT";
    string private constant ERROR_NOT_LOCK_MANAGER = "STAKING_NOT_LOCK_MANAGER";
    string private constant ERROR_AMOUNT_ZERO = "STAKING_AMOUNT_ZERO";
    string private constant ERROR_TOKEN_TRANSFER = "STAKING_TOKEN_TRANSFER";
    string private constant ERROR_NOT_ENOUGH_BALANCE = "STAKING_NOT_ENOUGH_BALANCE";
    string private constant ERROR_LOCK_ALREADY_EXISTS = "STAKING_LOCK_ALREADY_EXISTS";
    string private constant ERROR_LOCK_DOES_NOT_EXIST = "STAKING_LOCK_DOES_NOT_EXIST";
    string private constant ERROR_CAN_NOT_UNLOCK = "STAKING_CAN_NOT_UNLOCK";
    string private constant ERROR_UNLOCKED_LOCK = "STAKING_UNLOCKED_LOCK";
    string private constant ERROR_INCREASING_LOCK_AMOUNT = "STAKING_INCREASING_LOCK_AMOUNT";

    struct Lock {
        uint256 amount;
        uint64 unlockedAt; // TODO: remove!
        bytes data;
    }

    struct Account {
        mapping (address => Lock) locks; // from manager to lock
        uint256 totalLocked;
        Checkpointing.History stakedHistory;
    }

    ERC20 internal stakingToken;
    mapping (address => Account) internal accounts;
    Checkpointing.History internal totalStakedHistory;

    event StakeTransferred(address indexed from, address indexed fromLockId, uint256 amount, address to, address toLockId);

    function initialize(ERC20 _stakingToken) external onlyInit {
        require(isContract(_stakingToken), ERROR_TOKEN_NOT_CONTRACT);
        initialized();
        stakingToken = _stakingToken;
    }

    /* External functions */

    /**
     * @notice Stakes `_amount` tokens, transferring them from `msg.sender`
     * @param _amount Number of tokens staked
     * @param _data Used in Staked event, to add signalling information in more complex staking applications
     */
    function stake(uint256 _amount, bytes _data) external isInitialized {
        _stakeFor(msg.sender, _amount, _data);
    }

    /**
     * @notice Stakes `_amount` tokens, transferring them from caller, and assigns them to `_accountAddress`
     * @param _accountAddress The final staker of the tokens
     * @param _amount Number of tokens staked
     * @param _data Used in Staked event, to add signalling information in more complex staking applications
     */
    function stakeFor(address _accountAddress, uint256 _amount, bytes _data) external isInitialized {
        _stakeFor(_accountAddress, _amount, _data);
    }

    /**
     * @notice Unstakes `_amount` tokens, returning them to the user
     * @param _amount Number of tokens staked
     * @param _data Used in Unstaked event, to add signalling information in more complex staking applications
     */
    function unstake(uint256 _amount, bytes _data) external isInitialized {
        // unstaking 0 tokens is not allowed
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // checkpoint updated staking balance
        _modifyStakeBalance(msg.sender, _amount, false);

        // checkpoint total supply
        _modifyTotalStaked(_amount, false);

        // transfer tokens
        require(stakingToken.safeTransfer(msg.sender, _amount), ERROR_TOKEN_TRANSFER);

        emit Unstaked(msg.sender, _amount, totalStakedFor(msg.sender), _data);
    }

    /**
     * @notice Lock `_amount` staked tokens and assign `_lockManager` as manager with `_data` as data, so they can not be unstaked
     * @param _amount The amount of tokens to be locked
     * @param _lockManager The manager entity for this particular lock. This entity will have full control over the lock, in particular will be able to unlock it
     * @param _data Data to parametrize logic for the lock to be enforced by the manager
     */
    function lock(uint256 _amount, address _lockManager, bytes _data) external isInitialized {
        Account storage account = accounts[msg.sender];
        // locking 0 tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // check enough unlocked tokens are available
        require(_amount <= _unlockedBalanceOf(msg.sender), ERROR_NOT_ENOUGH_BALANCE);

        Lock storage lock_ = account.locks[_lockManager];
        // check if lock exists
        require(lock_.unlockedAt == 0, ERROR_LOCK_ALREADY_EXISTS);
        lock_.amount = _amount;
        lock_.unlockedAt = MAX_UINT64;
        lock_.data = _data;

        // update total
        account.totalLocked = account.totalLocked.add(_amount);

        emit Locked(msg.sender, _lockManager, _amount, _data);
    }

    /**
     * @notice Transfer `_amount` tokens to `_to``_toLockManager != 0 ? '\'s lock ' + _toLockManager : ''`
     * @param _to Recipient of the tokens
     * @param _toLockManager Manager of the recipient lock to add the tokens to, if any
     * @param _amount Number of tokens to be transferred
     */
    function transfer(address _to, address _toLockManager, uint256 _amount) external isInitialized {
        // have enough unlocked funds
        require(_amount <= _unlockedBalanceOf(msg.sender), ERROR_NOT_ENOUGH_BALANCE);

        _transfer(msg.sender, address(0), _to, _toLockManager, _amount);
    }

    /**
     * @notice Transfer `_amount` tokens from `_from`'s lock by `msg.sender` to `_to``_toLockManager > 0 ? '\'s lock by ' + _toLockManager : ''`
     * @param _from Owner of locked tokens
     * @param _to Recipient of the tokens
     * @param _toLockManager Manager of the recipient lock to add the tokens to, if any
     * @param _amount Number of tokens to be transferred
     */
    function transferFromLock(
        address _from,
        address _to,
        address _toLockManager,
        uint256 _amount
    )
        external
    {
        // No need to check that have enough locked funds, as _decreaseActiveLockAmount will fail

        _transfer(_from, msg.sender, _to, _toLockManager, _amount);
        _decreaseActiveLockAmount(_from, msg.sender, _amount);
    }

    /**
     * @notice Decrease the amount of tokens locked in `_accountAddress`'s lock by `msg.sender` to `_newAmount`
     * @param _accountAddress Owner of locked tokens
     * @param _newAmount New amount of locked tokens
     */
    function decreaseLockAmount(address _accountAddress, uint256 _newAmount) external {
        // lock 0 tokens makes no sense
        require(_newAmount > 0, ERROR_AMOUNT_ZERO);

        // manager can only decrease locked amount
        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[msg.sender];
        require(_newAmount < lock_.amount, ERROR_INCREASING_LOCK_AMOUNT);

        // update total
        // no need for SafeMath:
        // - totalLocked must be greater or equal than lock._amount
        // - final result will be less than initial one (checked in require above)
        account.totalLocked = account.totalLocked - lock_.amount + _newAmount;

        // update lock amount
        lock_.amount = _newAmount;

        emit LockAmountChanged(_accountAddress, msg.sender, _newAmount);
    }

    /**
     * @notice Change the manager of `_accountAddress`'s lock from `msg.sender` to `_newLockManager`
     * @param _accountAddress Owner of lock
     * @param _newLockManager New lock's manager
     */
    function setLockManager(address _accountAddress, address _newLockManager) external {
        Lock storage oldLock = accounts[_accountAddress].locks[msg.sender];
        accounts[_accountAddress].locks[_newLockManager] = oldLock;

        oldLock.amount = 0;
        oldLock.unlockedAt = 0;
        oldLock.data = new bytes(0); // TODO: make sure this is properly cleaned

        emit LockManagerChanged(_accountAddress, msg.sender, _newLockManager);
    }

    /**
     * @notice Change data of `_accountAddress`'s lock by `_lockManager` to `_newData`
     * @param _accountAddress Owner of lock
     * @param _newData New data containing logic to enforce the lock
     */
    function setLockData(address _accountAddress, bytes _newData) external {
        accounts[_accountAddress].locks[msg.sender].data = _newData;
        emit LockDataChanged(_accountAddress, msg.sender, _newData);
    }

    /**
     * @notice Unlock `_accountAddress`'s lock by `_lockManager` so locked tokens can be unstaked again
     * @param _accountAddress Owner of locked tokens
     * @param _lockManager Manager of the lock for the given account
     */
    function unlock(address _accountAddress, address _lockManager) external {
        _unlock(_accountAddress, _lockManager);
    }

    /**
     * @notice Get the token used by the contract for staking and locking
     * @return The token used by the contract for staking and locking
     */
    function token() external view isInitialized returns (address) {
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
     * @notice Get last time `_accountAddress` modified its staked balance
     * @param _accountAddress Account requesting for
     * @return Last block number when account's balance was modified
     */
    function lastStakedFor(address _accountAddress) external view isInitialized returns (uint256) {
        return accounts[_accountAddress].stakedHistory.lastUpdated();
    }

    /**
     * @notice Get total amount of locked tokens for `_accountAddress`
     * @param _accountAddress Owner of locks
     * @return Total amount of locked tokens
     */
    function getTotalLocked(address _accountAddress) external view isInitialized returns (uint256) {
        return accounts[_accountAddress].totalLocked;
    }

    /**
     * @notice Get details of `_accountAddress`'s lock by `_lockManager`
     * @param _accountAddress Owner of lock
     * @param _lockManager Manager of the lock for the given account
     * @return Amount of locked tokens
     * @return Block number when the lock was released
     * @return Lock's data
     */
    function getLock(address _accountAddress, address _lockManager)
        external
        view
        isInitialized
        returns (
            uint256 _amount,
            uint64 _unlockedAt,
            bytes _data
        )
    {
        Lock storage lock_ = accounts[_accountAddress].locks[_lockManager];
        _unlockedAt = lock_.unlockedAt;
        require(_unlockedAt > 0, ERROR_LOCK_DOES_NOT_EXIST);
        _amount = lock_.amount;
        _data = lock_.data;
    }

    /**
     * @notice Get the total amount of tokens staked by `_accountAddress` at block number `_blockNumber`
     * @param _accountAddress Account requesting for
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked by the account at the given block number
     */
    function totalStakedForAt(address _accountAddress, uint256 _blockNumber) external view returns (uint256) {
        return accounts[_accountAddress].stakedHistory.get(_blockNumber);
    }

    /**
     * @notice Get the total amount of tokens staked by all users at block number `_blockNumber`
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked at the given block number
     */
    function totalStakedAt(uint256 _blockNumber) external view returns (uint256) {
        return totalStakedHistory.get(_blockNumber);
    }

    /**
     * @notice Get the staked but unlocked amount of tokens by `_accountAddress`
     * @param _accountAddress Owner of the staked but unlocked balance
     * @return Amount of tokens staked but not locked by given account
     */
    function unlockedBalanceOf(address _accountAddress) external view returns (uint256) {
        return _unlockedBalanceOf(_accountAddress);
    }

    /**
     * @notice Check if `_accountAddress`'s by `_lockManager` can be unlocked
     * @param _accountAddress Owner of lock
     * @param _lockManager Manager of the lock for the given account
     * @return Whether given lock of given account can be unlocked
     */
    function canUnlock(address _accountAddress, address _lockManager) external view returns (bool) {
        return _canUnlock(_accountAddress, _lockManager);
    }

    /* Public functions */

    /**
     * @notice Get the amount of tokens staked by `_accountAddress`
     * @param _accountAddress The owner of the tokens
     * @return The amount of tokens staked by the given account
     */
    function totalStakedFor(address _accountAddress) public view returns (uint256) {
        // we assume it's not possible to stake in the future
        return accounts[_accountAddress].stakedHistory.getLatestValue();
    }

    /**
     * @notice Get the total amount of tokens staked by all users
     * @return The total amount of tokens staked by all users
     */
    function totalStaked() public view returns (uint256) {
        // we assume it's not possible to stake in the future
        return totalStakedHistory.getLatestValue();
    }

    /*
    function multicall(bytes[] _calls) public {
        for(uint i = 0; i < _calls.length; i++) {
            require(address(this).delegatecall(_calls[i]), ERROR_MULTICALL_DELEGATECALL);
        }
    }
    */

    /* Internal functions */

    function _stakeFor(address _accountAddress, uint256 _amount, bytes _data) internal {
        // staking 0 tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // checkpoint updated staking balance
        _modifyStakeBalance(_accountAddress, _amount, true);

        // checkpoint total supply
        _modifyTotalStaked(_amount, true);

        // pull tokens into Staking contract
        require(stakingToken.safeTransferFrom(msg.sender, this, _amount), ERROR_TOKEN_TRANSFER);

        emit Staked(_accountAddress, _amount, totalStakedFor(_accountAddress), _data);
    }

    function _modifyStakeBalance(address _accountAddress, uint256 _by, bool _increase) internal {
        uint256 currentStake = totalStakedFor(_accountAddress);

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            newStake = currentStake.sub(_by);
        }

        // add new value to account history
        accounts[_accountAddress].stakedHistory.add64(getBlockNumber64(), newStake);
    }

    function _modifyTotalStaked(uint256 _by, bool _increase) internal {
        uint256 currentStake = totalStaked();

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            newStake = currentStake.sub(_by);
        }

        // add new value to total history
        totalStakedHistory.add64(getBlockNumber64(), newStake);
    }

    function _unlock(address _accountAddress, address _lockManager) internal {
        // only manager and owner (if manager allows) can unlock
        require(_canUnlock(_accountAddress, _lockManager), ERROR_CAN_NOT_UNLOCK);

        _unsafeUnlock(_accountAddress, _lockManager);
    }

    function _unsafeUnlock(address _accountAddress, address _lockManager) internal {
        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[_lockManager];

        lock_.unlockedAt = getTimestamp64();

        // update total
        // no need for SafeMath: totalLocked must be greater or equal than lock._amount
        account.totalLocked = account.totalLocked - lock_.amount;

        emit Unlocked(_accountAddress, _lockManager, lock_.amount, lock_.data);
    }

    function _increaseActiveLockAmount(address _accountAddress, address _lockManager, uint256 _amount) internal {
        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[_lockManager];
        // check that lock hasn't been unlocked
        require(lock_.unlockedAt > getTimestamp64(), ERROR_UNLOCKED_LOCK); // locks are created with a MAX_UINT64 unlockedAt

        lock_.amount = lock_.amount.add(_amount);

        // update total
        account.totalLocked = account.totalLocked.add(_amount);
    }

    function _decreaseActiveLockAmount(address _accountAddress, address _lockManager, uint256 _amount) internal {
        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[_lockManager];
        // check that lock hasn't been unlocked
        require(lock_.unlockedAt > getTimestamp64(), ERROR_UNLOCKED_LOCK); // locks are created with a MAX_UINT64 unlockedAt

        lock_.amount = lock_.amount.sub(_amount);

        // update total
        // no need for SafeMath: totalLocked must be greater or equal than lock._amount
        account.totalLocked = account.totalLocked - _amount;

        // if lock gets down to zero, unlock
        if (lock_.amount == 0) {
            // it comes from transferFromLock, which uses msg.sender as _lockManager
            _unsafeUnlock(_accountAddress, _lockManager);
        }
    }

    function _transfer(address _from, address _fromLockManager, address _to, address _toLockManager, uint256 _amount) internal {
        // transferring 0 staked tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // _toLockManager = 0 means no lock
        if (_toLockManager != address(0)) {
            _increaseActiveLockAmount(_to, _toLockManager, _amount);
        }

        // update stakes
        _modifyStakeBalance(_from, _amount, false);
        _modifyStakeBalance(_to, _amount, true);

        emit StakeTransferred(_from, _fromLockManager, _amount, _to, _toLockManager);
    }

    /**
     * @notice Get the staked but unlocked amount of tokens by `_accountAddress`
     * @param _accountAddress Owner of the staked but unlocked balance
     * @return Amount of tokens staked but not locked by given account
     */
    function _unlockedBalanceOf(address _accountAddress) internal view returns (uint256) {
        uint256 unlockedTokens = totalStakedFor(_accountAddress).sub(accounts[_accountAddress].totalLocked);

        return unlockedTokens;
    }

    /**
     * @notice Check if `_accountAddress`'s by `_lockManager` can be unlocked
     * @param _accountAddress Owner of lock
     * @param _lockManager Manager of the lock for the given account
     * @return Whether given lock of given account can be unlocked
     */
    function _canUnlock(address _accountAddress, address _lockManager) internal view returns (bool) {
        Lock storage lock_ = accounts[_accountAddress].locks[_lockManager];

        require(lock_.unlockedAt > 0, ERROR_LOCK_DOES_NOT_EXIST);

        if (msg.sender == _lockManager ||
            (msg.sender == _accountAddress && ILockManager(_lockManager).canUnlock(_accountAddress, lock_.data))) {
            return true;
        }

        return false;
    }
}
