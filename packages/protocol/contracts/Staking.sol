pragma solidity 0.5.17;

import "./lib/Checkpointing.sol";
import "./lib/os/IsContract.sol";
import "./lib/os/SafeMath.sol";
import "./lib/os/SafeERC20.sol";
import "./lib/os/TimeHelpers.sol";

import "./locking/ILockable.sol";
import "./locking/ILockManager.sol";

import "./standards/IERC900.sol";
import "./standards/IERC900History.sol";
import "./standards/IApproveAndCallFallBack.sol";


contract Staking is IERC900, IERC900History, ILockable, IApproveAndCallFallBack, IsContract, TimeHelpers {
    using Checkpointing for Checkpointing.History;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 private constant MAX_UINT64 = uint256(uint64(-1));

    string private constant ERROR_TOKEN_NOT_CONTRACT = "STAKING_TOKEN_NOT_CONTRACT";
    string private constant ERROR_AMOUNT_ZERO = "STAKING_AMOUNT_ZERO";
    string private constant ERROR_TOKEN_TRANSFER = "STAKING_TOKEN_TRANSFER_FAIL";
    string private constant ERROR_TOKEN_DEPOSIT = "STAKING_TOKEN_DEPOSIT_FAIL";
    string private constant ERROR_WRONG_TOKEN = "STAKING_WRONG_TOKEN";
    string private constant ERROR_NOT_ENOUGH_BALANCE = "STAKING_NOT_ENOUGH_BALANCE";
    string private constant ERROR_NOT_ENOUGH_ALLOWANCE = "STAKING_NOT_ENOUGH_ALLOWANCE";
    string private constant ERROR_ALLOWANCE_ZERO = "STAKING_ALLOWANCE_ZERO";
    string private constant ERROR_LOCK_ALREADY_EXISTS = "STAKING_LOCK_ALREADY_EXISTS";
    string private constant ERROR_LOCK_DOES_NOT_EXIST = "STAKING_LOCK_DOES_NOT_EXIST";
    string private constant ERROR_NOT_ENOUGH_LOCK = "STAKING_NOT_ENOUGH_LOCK";
    string private constant ERROR_CANNOT_UNLOCK = "STAKING_CANNOT_UNLOCK";
    string private constant ERROR_CANNOT_CHANGE_ALLOWANCE = "STAKING_CANNOT_CHANGE_ALLOWANCE";
    string private constant ERROR_BLOCKNUMBER_TOO_BIG = "STAKING_BLOCKNUMBER_TOO_BIG";

    event StakeTransferred(address indexed from, address indexed to, uint256 amount);

    struct Lock {
        uint256 amount;
        uint256 allowance; // A lock is considered active when its allowance is greater than zero, and the allowance is always greater than or equal to amount
    }

    struct Account {
        mapping (address => Lock) locks; // Mapping of lock manager => lock info
        uint256 totalLocked;
        Checkpointing.History stakedHistory;
    }

    IERC20 public token;
    mapping (address => Account) internal accounts;
    Checkpointing.History internal totalStakedHistory;

    /**
     * @notice Initialize Staking app with token `_token`
     * @param _token ERC20 token used for staking
     */
    constructor(IERC20 _token) public {
        require(isContract(address(_token)), ERROR_TOKEN_NOT_CONTRACT);
        token = _token;
    }

    /**
     * @notice Stake `@tokenAmount(self.token(): address, _amount)`
     * @dev Callable only by a user
     * @param _amount Amount of tokens to be staked
     * @param _data Optional data emitted with the Staked event, to add signalling information in more complex staking applications
     */
    function stake(uint256 _amount, bytes calldata _data) external {
        _stakeFor(msg.sender, msg.sender, _amount, _data);
    }

    /**
     * @notice Stake `@tokenAmount(self.token(): address, _amount)` for `_user`
     * @dev Callable only by a user
     * @param _user Address to stake tokens to
     * @param _amount Amount of tokens to be staked
     * @param _data Optional data emitted with the Staked event, to add signalling information in more complex staking applications
     */
    function stakeFor(address _user, uint256 _amount, bytes calldata _data) external {
        _stakeFor(msg.sender, _user, _amount, _data);
    }

    /**
     * @notice Unstake `@tokenAmount(self.token(): address, _amount)`
     * @dev Callable only by a user
     * @param _amount Amount of tokens to be unstaked
     * @param _data Optional data emitted with the Unstaked event, to add signalling information in more complex staking applications
     */
    function unstake(uint256 _amount, bytes calldata _data) external {
        // _unstake() expects the caller to do this check
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        _unstake(msg.sender, _amount, _data);
    }

    /**
     * @notice Allow `_lockManager` to lock up to `@tokenAmount(self.token(): address, _allowance)` of your staked balance
     * @dev Callable only by a user.
     *      This creates a new lock, so this manager cannot have an existing lock in place for the caller.
     * @param _lockManager Lock manager
     * @param _allowance Amount of tokens the manager will be allowed to lock
     * @param _data Optional, arbitrary data to be submitted to the manager
     */
    function allowManager(address _lockManager, uint256 _allowance, bytes calldata _data) external {
        _allowManager(_lockManager, _allowance, _data);
    }

    /**
     * @notice Transfer `@tokenAmount(self.token(): address, _amount)` to `_to`’s staked balance
     * @dev Callable only by a user
     * @param _to Recipient
     * @param _amount Amount of tokens to be transferred
     */
    function transfer(address _to, uint256 _amount) external {
        _transfer(msg.sender, _to, _amount);
    }

    /**
     * @notice Transfer `@tokenAmount(self.token(): address, _amount)` directly to `_to`’s balance
     * @dev Callable only by a user
     * @param _to Recipient
     * @param _amount Amount of tokens to be transferred
     */
    function transferAndUnstake(address _to, uint256 _amount) external {
        _transferAndUnstake(msg.sender, _to, _amount);
    }

    /**
     * @notice Slash `@tokenAmount(self.token(): address, _amount)` from `_from`'s locked balance to `_to`'s staked balance
     * @dev Callable only by a lock manager
     * @param _from Owner of the locked tokens
     * @param _to Recipient
     * @param _amount Amount of tokens to be transferred via slashing
     */
    function slash(address _from, address _to, uint256 _amount) external {
        _unlockUnsafe(_from, msg.sender, _amount);
        _transfer(_from, _to, _amount);
    }

    /**
     * @notice Slash `@tokenAmount(self.token(): address, _amount)` from `_from`'s locked balance  directly to `_to`'s balance
     * @dev Callable only by a lock manager
     * @param _from Owner of the locked tokens
     * @param _to Recipient
     * @param _amount Amount of tokens to be transferred via slashing
     */
    function slashAndUnstake(address _from, address _to, uint256 _amount) external {
        _unlockUnsafe(_from, msg.sender, _amount);
        _transferAndUnstake(_from, _to, _amount);
    }

    /**
     * @notice Slash `@tokenAmount(self.token(): address, _slashAmount)` from `_from`'s locked balance to `_to`'s staked balance, and leave an additional `@tokenAmount(self.token(): address, _unlockAmount)` unlocked for `_from`
     * @dev Callable only by a lock manager
     * @param _from Owner of the locked tokens
     * @param _to Recipient
     * @param _unlockAmount Amount of tokens to be left unlocked
     * @param _slashAmount Amount of tokens to be transferred via slashing
     */
    function slashAndUnlock(
        address _from,
        address _to,
        uint256 _unlockAmount,
        uint256 _slashAmount
    )
        external
    {
        _unlockUnsafe(_from, msg.sender, _unlockAmount.add(_slashAmount));
        _transfer(_from, _to, _slashAmount);
    }

    /**
     * @notice Increase allowance of lock manager `_lockManager` by `@tokenAmount(self.token(): address, _allowance)`
     * @dev Callable only by a user
     * @param _lockManager Lock manager
     * @param _allowance Amount to increase allowance by
     */
    function increaseLockAllowance(address _lockManager, uint256 _allowance) external {
        Lock storage lock_ = accounts[msg.sender].locks[_lockManager];
        require(lock_.allowance > 0, ERROR_LOCK_DOES_NOT_EXIST);

        _increaseLockAllowance(_lockManager, lock_, _allowance);
    }

    /**
     * @notice Decrease allowance of lock manager `_lockManager` by `@tokenAmount(self.token(): address, _allowance)`
     * @dev Callable only by the user or lock manager.
     *      Cannot completely remove the allowance to the lock manager (and deactivate the lock).
     * @param _user Owner of the locked tokens
     * @param _lockManager Lock manager
     * @param _allowance Amount to decrease allowance by
     */
    function decreaseLockAllowance(address _user, address _lockManager, uint256 _allowance) external {
        require(msg.sender == _user || msg.sender == _lockManager, ERROR_CANNOT_CHANGE_ALLOWANCE);
        require(_allowance > 0, ERROR_AMOUNT_ZERO);

        Lock storage lock_ = accounts[_user].locks[_lockManager];
        uint256 newAllowance = lock_.allowance.sub(_allowance);
        require(newAllowance >= lock_.amount, ERROR_NOT_ENOUGH_ALLOWANCE);
        // unlockAndRemoveManager() must be used for this:
        require(newAllowance > 0, ERROR_ALLOWANCE_ZERO);

        lock_.allowance = newAllowance;

        emit LockAllowanceChanged(_user, _lockManager, newAllowance);
    }

    /**
     * @notice Lock `@tokenAmount(self.token(): address, _amount)` to lock manager `msg.sender`
     * @dev Callable only by an allowed lock manager
     * @param _user Owner of the locked tokens
     * @param _amount Amount of tokens to lock
     */
    function lock(address _user, uint256 _amount) external {
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // check enough unlocked tokens are available
        require(_amount <= _unlockedBalanceOf(_user), ERROR_NOT_ENOUGH_BALANCE);

        Account storage account = accounts[_user];
        Lock storage lock_ = account.locks[msg.sender];

        uint256 newAmount = lock_.amount.add(_amount);
        // check allowance is enough, it also means that lock exists, as newAmount is greater than zero
        require(newAmount <= lock_.allowance, ERROR_NOT_ENOUGH_ALLOWANCE);

        lock_.amount = newAmount;

        // update total
        account.totalLocked = account.totalLocked.add(_amount);

        emit LockAmountChanged(_user, msg.sender, newAmount);
    }

    /**
     * @notice Unlock `@tokenAmount(self.token(): address, _amount)` from lock manager `_lockManager`
     * @dev Callable only by the user or lock manager. If called by the user, checks with the lock manager whether the request should be allowed.
     * @param _user Owner of the locked tokens
     * @param _lockManager Lock manager
     * @param _amount Amount of tokens to unlock
     */
    function unlock(address _user, address _lockManager, uint256 _amount) external {
        // _unlockUnsafe() expects the caller to do this check
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        require(_canUnlockUnsafe(msg.sender, _user, _lockManager, _amount), ERROR_CANNOT_UNLOCK);

        _unlockUnsafe(_user, _lockManager, _amount);
    }

    /**
     * @notice Unlock all tokens from lock manager `_lockManager` and remove them as a manager
     * @dev Callable only by the user or lock manager. If called by the user, checks with the lock manager whether the request should be allowed.
     * @param _user Owner of the locked tokens
     * @param _lockManager Lock manager
     */
    function unlockAndRemoveManager(address _user, address _lockManager) external {
        require(_canUnlockUnsafe(msg.sender, _user, _lockManager, 0), ERROR_CANNOT_UNLOCK);

        Account storage account = accounts[_user];
        Lock storage lock_ = account.locks[_lockManager];

        uint256 amount = lock_.amount;
        // update total
        account.totalLocked = account.totalLocked.sub(amount);

        emit LockAmountChanged(_user, _lockManager, 0);
        emit LockManagerRemoved(_user, _lockManager);

        delete account.locks[_lockManager];
    }

    /**
    /**
     * @dev ApproveAndCallFallBack compliance.
     *      Stakes the approved tokens for the user, allowing users to stake their tokens in a single transaction.
     *      Callable only by the staking token.
     * @param _from Account approving tokens
     * @param _amount Amount of tokens being approved
     * @param _token Token being approved, should be the caller
     * @param _data Optional data emitted with the Staked event, to add signalling information in more complex staking applications
     */
    function receiveApproval(address _from, uint256 _amount, address _token, bytes calldata _data) external {
        require(_token == msg.sender && _token == address(token), ERROR_WRONG_TOKEN);

        _stakeFor(_from, _from, _amount, _data);
    }

    /**
     * @dev Tell whether the history methods are supported
     * @return Always true
     */
    function supportsHistory() external pure returns (bool) {
        return true;
    }

    /**
     * @dev Tell the last time `_user` modified their staked balance
     * @param _user Address
     * @return Last block number the account's staked balance was modified. 0 if it has never been modified.
     */
    function lastStakedFor(address _user) external view returns (uint256) {
        return accounts[_user].stakedHistory.lastUpdate();
    }

    /**
     * @dev Tell the current locked balance for `_user`
     * @param _user Address
     * @return Amount of locked tokens owned by the requested account across all locks
     */
    function lockedBalanceOf(address _user) external view returns (uint256) {
        return _lockedBalanceOf(_user);
    }

    /**
     * @dev Tell details of `_user`'s lock managed by `_lockManager`
     * @param _user Address
     * @param _lockManager Lock manager
     * @return Amount of locked tokens
     * @return Amount of tokens that lock manager is allowed to lock
     */
    function getLock(address _user, address _lockManager)
        external
        view
        returns (
            uint256 _amount,
            uint256 _allowance
        )
    {
        Lock storage lock_ = accounts[_user].locks[_lockManager];
        _amount = lock_.amount;
        _allowance = lock_.allowance;
    }

    /**
     * @dev Tell the current staked and locked balances for `_user`
     * @param _user Address
     * @return Staked balance
     * @return Locked balance
     */
    function getBalancesOf(address _user) external view returns (uint256 staked, uint256 locked) {
        staked = _totalStakedFor(_user);
        locked = _lockedBalanceOf(_user);
    }

    /**
     * @dev Tell the current staked balance for `_user`
     * @param _user Address
     * @return Staked balance
     */
    function totalStakedFor(address _user) external view returns (uint256) {
        return _totalStakedFor(_user);
    }

    /**
     * @dev Tell the total staked balance from all users
     * @return The total amount of staked tokens from all users
     */
    function totalStaked() external view returns (uint256) {
        return _totalStaked();
    }

    /**
     * @dev Tell the staked balance for `_user` at block number `_blockNumber`
     * @param _user Address
     * @param _blockNumber Block height
     * @return Staked balance at the given block number
     */
    function totalStakedForAt(address _user, uint256 _blockNumber) external view returns (uint256) {
        require(_blockNumber <= MAX_UINT64, ERROR_BLOCKNUMBER_TOO_BIG);

        return accounts[_user].stakedHistory.get(uint64(_blockNumber));
    }

    /**
     * @dev Tell the total staked balance from all users at block number `_blockNumber`
     * @param _blockNumber Block height
     * @return The total amount of staked tokens from all users at the given block number
     */
    function totalStakedAt(uint256 _blockNumber) external view returns (uint256) {
        require(_blockNumber <= MAX_UINT64, ERROR_BLOCKNUMBER_TOO_BIG);

        return totalStakedHistory.get(uint64(_blockNumber));
    }

    /**
     * @dev Tell the portion of `user`'s staked balance that can be immediately withdrawn
     * @param _user Address
     * @return Amount of tokens available to be withdrawn
     */
    function unlockedBalanceOf(address _user) external view returns (uint256) {
        return _unlockedBalanceOf(_user);
    }

    /**
     * @dev Check if `_sender` can unlock `@tokenAmount(self.token(): address, _amount)` from `_user`'s lock managed by `_lockManager`
     * @param _sender Address that would try to unlock tokens
     * @param _user Owner of lock
     * @param _lockManager Lock manager
     * @param _amount Amount of locked tokens to unlock. If zero, the full locked amount.
     * @return Whether sender is allowed to unlock tokens from the given lock
     */
    function canUnlock(address _sender, address _user, address _lockManager, uint256 _amount) external view returns (bool) {
        return _canUnlockUnsafe(_sender, _user, _lockManager, _amount);
    }

    function _stakeFor(address _from, address _user, uint256 _amount, bytes memory _data) internal {
        // staking 0 tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // checkpoint updated staking balance
        uint256 newStake = _modifyStakeBalance(_user, _amount, true);

        // checkpoint total supply
        _modifyTotalStaked(_amount, true);

        // pull tokens into Staking contract
        require(token.safeTransferFrom(_from, address(this), _amount), ERROR_TOKEN_DEPOSIT);

        emit Staked(_user, _amount, newStake, _data);
    }

    /**
     * @dev Assumes the caller has already checked _amount > 0
     */
    function _unstake(address _from, uint256 _amount, bytes memory _data) internal {
        // checkpoint updated staking balance
        uint256 newStake = _modifyStakeBalance(_from, _amount, false);

        // checkpoint total supply
        _modifyTotalStaked(_amount, false);

        // transfer tokens
        require(token.safeTransfer(_from, _amount), ERROR_TOKEN_TRANSFER);

        emit Unstaked(_from, _amount, newStake, _data);
    }

    function _modifyStakeBalance(address _user, uint256 _by, bool _increase) internal returns (uint256) {
        uint256 currentStake = _totalStakedFor(_user);

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            require(_by <= _unlockedBalanceOf(_user), ERROR_NOT_ENOUGH_BALANCE);
            newStake = currentStake.sub(_by);
        }

        // add new value to account history
        accounts[_user].stakedHistory.add(getBlockNumber64(), newStake);

        return newStake;
    }

    function _modifyTotalStaked(uint256 _by, bool _increase) internal {
        uint256 currentStake = _totalStaked();

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            newStake = currentStake.sub(_by);
        }

        // add new value to total history
        totalStakedHistory.add(getBlockNumber64(), newStake);
    }

    function _allowManager(address _lockManager, uint256 _allowance, bytes memory _data) internal {
        Lock storage lock_ = accounts[msg.sender].locks[_lockManager];
        // ensure lock doesn't exist yet
        require(lock_.allowance == 0, ERROR_LOCK_ALREADY_EXISTS);

        emit NewLockManager(msg.sender, _lockManager, _data);

        _increaseLockAllowance(_lockManager, lock_, _allowance);
    }

    function _increaseLockAllowance(address _lockManager, Lock storage _lock, uint256 _allowance) internal {
        require(_allowance > 0, ERROR_AMOUNT_ZERO);

        uint256 newAllowance = _lock.allowance.add(_allowance);
        _lock.allowance = newAllowance;

        emit LockAllowanceChanged(msg.sender, _lockManager, newAllowance);
    }

    /**
     * @dev Assumes `canUnlock` passes, i.e., either sender is the lock manager or it’s the owner,
     *      and the lock manager allows to unlock.
     */
    function _unlockUnsafe(address _user, address _lockManager, uint256 _amount) internal {
        Account storage account = accounts[_user];
        Lock storage lock_ = account.locks[_lockManager];

        uint256 lockAmount = lock_.amount;
        require(lockAmount >= _amount, ERROR_NOT_ENOUGH_LOCK);

        // update lock amount
        // No need for SafeMath: checked just above
        uint256 newAmount = lockAmount - _amount;
        lock_.amount = newAmount;

        // update total
        account.totalLocked = account.totalLocked.sub(_amount);

        emit LockAmountChanged(_user, _lockManager, newAmount);
    }

    function _transfer(address _from, address _to, uint256 _amount) internal {
        // transferring 0 staked tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // update stakes
        _modifyStakeBalance(_from, _amount, false);
        _modifyStakeBalance(_to, _amount, true);

        emit StakeTransferred(_from, _to, _amount);
    }

    /**
     * @dev This is similar to a `_transfer()` followed by a `_unstake()`, but optimized to avoid spurious SSTOREs on modifying _to's checkpointed balance
     */
    function _transferAndUnstake(address _from, address _to, uint256 _amount) internal {
        // transferring 0 staked tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // update stake
        uint256 newStake = _modifyStakeBalance(_from, _amount, false);

        // checkpoint total supply
        _modifyTotalStaked(_amount, false);

        emit Unstaked(_from, _amount, newStake, new bytes(0));

        // transfer tokens
        require(token.safeTransfer(_to, _amount), ERROR_TOKEN_TRANSFER);
    }

    function _totalStakedFor(address _user) internal view returns (uint256) {
        // we assume it's not possible to stake in the future
        return accounts[_user].stakedHistory.getLast();
    }

    function _totalStaked() internal view returns (uint256) {
        // we assume it's not possible to stake in the future
        return totalStakedHistory.getLast();
    }

    function _unlockedBalanceOf(address _user) internal view returns (uint256) {
        return _totalStakedFor(_user).sub(_lockedBalanceOf(_user));
    }

    function _lockedBalanceOf(address _user) internal view returns (uint256) {
        return accounts[_user].totalLocked;
    }

    /**
     * @dev If calling this from a state modifying function trying to unlock tokens, make sure the first parameter is `msg.sender`.
     * @param _sender Address that would try to unlock tokens
     * @param _user Owner of lock
     * @param _lockManager Lock manager
     * @param _amount Amount of locked tokens to unlock. If zero, the full locked amount.
     * @return Whether sender is allowed to unlock tokens from the given lock
     */
    function _canUnlockUnsafe(address _sender, address _user, address _lockManager, uint256 _amount) internal view returns (bool) {
        Lock storage lock_ = accounts[_user].locks[_lockManager];
        require(lock_.allowance > 0, ERROR_LOCK_DOES_NOT_EXIST);
        require(lock_.amount >= _amount, ERROR_NOT_ENOUGH_LOCK);

        uint256 amount = _amount == 0 ? lock_.amount : _amount;

        // If the sender is the lock manager, unlocking is allowed
        if (_sender == _lockManager) {
            return true;
        }

        // If the sender is neither the lock manager nor the owner, unlocking is not allowed
        if (_sender != _user) {
            return false;
        }

        // The sender must be the user
        // Allow unlocking if the amount of locked tokens for the user has already been decreased to 0
        if (amount == 0) {
            return true;
        }

        // Otherwise, check whether the lock manager allows unlocking
        return ILockManager(_lockManager).canUnlock(_user, amount);
    }
}
