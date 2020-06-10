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

    string private constant ERROR_TOKEN_NOT_CONTRACT = "STAKING_TOKEN_NOT_CONTRACT";
    string private constant ERROR_AMOUNT_ZERO = "STAKING_AMOUNT_ZERO";
    string private constant ERROR_TOKEN_TRANSFER = "STAKING_TOKEN_TRANSFER_FAIL";
    string private constant ERROR_TOKEN_DEPOSIT = "STAKING_TOKEN_DEPOSIT_FAIL";
    string private constant ERROR_TOKEN_NOT_SENDER = "STAKING_TOKEN_NOT_SENDER";
    string private constant ERROR_WRONG_TOKEN = "STAKING_WRONG_TOKEN";
    string private constant ERROR_NOT_ENOUGH_BALANCE = "STAKING_NOT_ENOUGH_BALANCE";
    string private constant ERROR_NOT_ENOUGH_ALLOWANCE = "STAKING_NOT_ENOUGH_ALLOWANCE";
    string private constant ERROR_NOT_ALLOWED = "STAKING_NOT_ALLOWED";
    string private constant ERROR_ALLOWANCE_ZERO = "STAKING_ALLOWANCE_ZERO";
    string private constant ERROR_LOCK_ALREADY_EXISTS = "STAKING_LOCK_ALREADY_EXISTS";
    string private constant ERROR_LOCK_DOES_NOT_EXIST = "STAKING_LOCK_DOES_NOT_EXIST";
    string private constant ERROR_NOT_ENOUGH_LOCK = "STAKING_NOT_ENOUGH_LOCK";
    string private constant ERROR_CANNOT_UNLOCK = "STAKING_CANNOT_UNLOCK";
    string private constant ERROR_CANNOT_CHANGE_ALLOWANCE = "STAKING_CANNOT_CHANGE_ALLOWANCE";
    string private constant ERROR_LOCKMANAGER_CALL_FAIL = "STAKING_LOCKMANAGER_CALL_FAIL";

    struct Lock {
        uint256 amount;
        uint256 allowance;  // must be greater than zero to consider the lock active, and always greater than or equal to amount
    }

    struct Account {
        mapping (address => Lock) locks; // from manager to lock
        uint256 totalLocked;
        Checkpointing.History stakedHistory;
    }

    ERC20 internal stakingToken;
    mapping (address => Account) internal accounts;
    Checkpointing.History internal totalStakedHistory;

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
        _stakeFor(msg.sender, msg.sender, _amount, _data);
    }

    /**
     * @notice Stakes `_amount` tokens, transferring them from caller, and assigns them to `_accountAddress`
     * @param _accountAddress The final staker of the tokens
     * @param _amount Number of tokens staked
     * @param _data Used in Staked event, to add signalling information in more complex staking applications
     */
    function stakeFor(address _accountAddress, uint256 _amount, bytes _data) external isInitialized {
        _stakeFor(msg.sender, _accountAddress, _amount, _data);
    }

    /**
     * @notice Unstakes `_amount` tokens, returning them to the user
     * @param _amount Number of tokens to unstake
     * @param _data Used in Unstaked event, to add signalling information in more complex staking applications
     */
    function unstake(uint256 _amount, bytes _data) external isInitialized {
        // unstaking 0 tokens is not allowed
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        _unstake(msg.sender, _amount, _data);
    }

    /**
     * @notice Allow `_lockManager` to lock up to `@tokenAmount(stakingToken: address, _allowance)` of `msg.sender`
     *         It creates a new lock, so the lock for this manager cannot exist before.
     * @param _lockManager The manager entity for this particular lock
     * @param _allowance Amount of tokens that the manager can lock
     * @param _data Data to parametrize logic for the lock to be enforced by the manager
     */
    function allowManager(address _lockManager, uint256 _allowance, bytes _data) external isInitialized {
        _allowManager(_lockManager, _allowance, _data);

        _callLockManagerCallback(0, _lockManager, _allowance, _data);
    }

    /**
     * @notice Lock `_amount` staked tokens and assign `_lockManager` as manager with `@tokenAmount(stakingToken: address, _allowance)` allowance and `_data` as data, so they can not be unstaked
     * @param _amount The amount of tokens to be locked
     * @param _lockManager The manager entity for this particular lock. This entity will have full control over the lock, in particular will be able to unlock it
     * @param _data Data to parametrize logic for the lock to be enforced by the manager
     */
    function allowManagerAndLock(uint256 _amount, address _lockManager, uint256 _allowance, bytes _data) external isInitialized {
        _allowManager(_lockManager, _allowance, _data);

        // locking 0 tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // check enough unlocked tokens are available
        require(_amount <= _unlockedBalanceOf(msg.sender), ERROR_NOT_ENOUGH_BALANCE);

        _lockUnsafe(msg.sender, _lockManager, _amount);

        _callLockManagerCallback(_amount, _lockManager, _allowance, _data);
    }

    /**
     * @notice Transfer `_amount` tokens to `_to`’s staked balance
     * @param _to Recipient of the tokens
     * @param _amount Number of tokens to be transferred
     */
    function transfer(address _to, uint256 _amount) external isInitialized {
        _transfer(msg.sender, _to, _amount);
    }

    /**
     * @notice Transfer `_amount` tokens to `_to`’s external balance (i.e. unstaked)
     * @param _to Recipient of the tokens
     * @param _amount Number of tokens to be transferred
     */
    function transferAndUnstake(address _to, uint256 _amount) external isInitialized {
        _transfer(msg.sender, _to, _amount);
        _unstake(_to, _amount, new bytes(0));
    }

    /**
     * @notice Transfer `@tokenAmount(stakingToken: address, _amount)` from `_from`'s lock by `msg.sender` to `_to`
     * @param _from Owner of locked tokens
     * @param _to Recipient of the tokens
     * @param _amount Number of tokens to be transferred
     */
    function slash(
        address _from,
        address _to,
        uint256 _amount
    )
        external
        isInitialized
    {
        _unlock(_from, msg.sender, _amount);
        _transfer(_from, _to, _amount);
    }

    /**
     * @notice Transfer `@tokenAmount(stakingToken: address, _amount)` from `_from`'s lock by `msg.sender` to `_to` (unstaked)
     * @param _from Owner of locked tokens
     * @param _to Recipient of the tokens
     * @param _amount Number of tokens to be transferred
     */
    function slashAndUnstake(
        address _from,
        address _to,
        uint256 _amount
    )
        external
        isInitialized
    {
        _unlock(_from, msg.sender, _amount);
        _transfer(_from, _to, _amount);
        _unstake(_to, _amount, new bytes(0));
    }

    /**
     * @notice Transfer `@tokenAmount(stakingToken: address, _transferAmount)` from `_from`'s lock by `msg.sender` to `_to`, and decrease `@tokenAmount(stakingToken: address, _decreaseAmount)` from that lock
     * @param _from Owner of locked tokens
     * @param _to Recipient of the tokens
     * @param _unlockAmount Number of tokens to be unlocked
     * @param _slashAmount Number of tokens to be transferred
     */
    function slashAndUnlock(
        address _from,
        address _to,
        uint256 _unlockAmount,
        uint256 _slashAmount
    )
        external
        isInitialized
    {
        // No need to check that _slashAmount is positive, as _transfer will fail
        // No need to check that have enough locked funds, as _unlock will fail
        require(_unlockAmount > 0, ERROR_AMOUNT_ZERO);

        _unlock(_from, msg.sender, _unlockAmount.add(_slashAmount));
        _transfer(_from, _to, _slashAmount);
    }

    /**
     * @notice Increase allowance in `@tokenAmount(stakingToken: address, _allowance)` of lock manager `_lockManager` for user `msg.sender`
     * @param _lockManager The manager entity for this particular lock
     * @param _allowance Amount of allowed tokens increase
     */
    function increaseLockAllowance(address _lockManager, uint256 _allowance) external isInitialized {
        Lock storage lock_ = accounts[msg.sender].locks[_lockManager];
        require(lock_.allowance > 0, ERROR_LOCK_DOES_NOT_EXIST);

        _increaseLockAllowance(_lockManager, lock_, _allowance);
    }

    /**
     * @notice Decrease allowance in `@tokenAmount(stakingToken: address, _allowance)` of lock manager `_lockManager` for user `_accountAddress`
     * @param _accountAddress Owner of locked tokens
     * @param _lockManager The manager entity for this particular lock
     * @param _allowance Amount of allowed tokens decrease
     */
    function decreaseLockAllowance(address _accountAddress, address _lockManager, uint256 _allowance) external isInitialized {
        // only owner and manager can decrease allowance
        require(msg.sender == _accountAddress || msg.sender == _lockManager, ERROR_CANNOT_CHANGE_ALLOWANCE);
        require(_allowance > 0, ERROR_AMOUNT_ZERO);

        Lock storage lock_ = accounts[_accountAddress].locks[_lockManager];
        uint256 newAllowance = lock_.allowance.sub(_allowance);
        require(newAllowance >= lock_.amount, ERROR_NOT_ENOUGH_ALLOWANCE);
        // unlockAndRemoveManager must be used for this:
        require(newAllowance > 0, ERROR_ALLOWANCE_ZERO);

        lock_.allowance = newAllowance;

        emit LockAllowanceChanged(_accountAddress, _lockManager, _allowance, false);
    }

    /**
     * @notice Increase locked amount by `@tokenAmount(stakingToken: address, _amount)` for user `_accountAddress` by lock manager `_lockManager`
     * @param _accountAddress Owner of locked tokens
     * @param _lockManager The manager entity for this particular lock
     * @param _amount Amount of locked tokens increase
     */
    function lock(address _accountAddress, address _lockManager, uint256 _amount) external isInitialized {
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // check enough unlocked tokens are available
        require(_amount <= _unlockedBalanceOf(_accountAddress), ERROR_NOT_ENOUGH_BALANCE);

        // we are locking funds from owner account, so only owner or manager are allowed
        require(msg.sender == _accountAddress || msg.sender == _lockManager, ERROR_NOT_ALLOWED);

        _lockUnsafe(_accountAddress, _lockManager, _amount);
    }

    /**
     * @notice Decrease locked amount by `@tokenAmount(stakingToken: address, _amount)` for user `_accountAddress` by lock manager `_lockManager`
     * @param _accountAddress Owner of locked tokens
     * @param _lockManager The manager entity for this particular lock
     * @param _amount Amount of locked tokens decrease
     */
    function unlock(address _accountAddress, address _lockManager, uint256 _amount) external isInitialized {
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // only manager and owner (if manager allows) can unlock
        require(_canUnlock(_accountAddress, _lockManager, _amount), ERROR_CANNOT_UNLOCK);

        _unlock(_accountAddress, _lockManager, _amount);
    }

    /**
     * @notice Unlock `_accountAddress`'s lock by `_lockManager` so locked tokens can be unstaked again
     * @param _accountAddress Owner of locked tokens
     * @param _lockManager Manager of the lock for the given account
     */
    function unlockAndRemoveManager(address _accountAddress, address _lockManager) external isInitialized {
        // only manager and owner (if manager allows) can unlock
        require(_canUnlock(_accountAddress, _lockManager, 0), ERROR_CANNOT_UNLOCK);

        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[_lockManager];

        uint256 amount = lock_.amount;
        // update total
        account.totalLocked = account.totalLocked.sub(amount);

        emit Unlocked(_accountAddress, _lockManager, amount);

        delete account.locks[_lockManager];
    }

    /**
     * @notice Change the manager of `_accountAddress`'s lock from `msg.sender` to `_newLockManager`
     * @param _accountAddress Owner of lock
     * @param _newLockManager New lock manager
     */
    function setLockManager(address _accountAddress, address _newLockManager) external isInitialized {
        Lock storage lock = accounts[_accountAddress].locks[msg.sender];
        require(lock.allowance > 0, ERROR_LOCK_DOES_NOT_EXIST);

        accounts[_accountAddress].locks[_newLockManager] = lock;

        delete accounts[_accountAddress].locks[msg.sender];

        emit LockManagerChanged(_accountAddress, msg.sender, _newLockManager);
    }

    /**
     * @dev MiniMeToken ApproveAndCallFallBack compliance
     * @param _from Account approving tokens
     * @param _amount Amount of `_token` tokens being approved
     * @param _token MiniMeToken that is being approved and that the call comes from
     * @param _data Used in Staked event, to add signalling information in more complex staking applications
     */
    function receiveApproval(address _from, uint256 _amount, address _token, bytes _data) external isInitialized {
        require(_token == msg.sender, ERROR_TOKEN_NOT_SENDER);
        require(_token == address(stakingToken), ERROR_WRONG_TOKEN);

        _stakeFor(_from, _from, _amount, _data);
    }

    /**
     * @notice Check whether it supports history of stakes
     * @return Always true
     */
    function supportsHistory() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Get the token used by the contract for staking and locking
     * @return The token used by the contract for staking and locking
     */
    function token() external view isInitialized returns (address) {
        return address(stakingToken);
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
     * @return Total amount of locked tokens for the requested account
     */
    function lockedBalanceOf(address _accountAddress) external view isInitialized returns (uint256) {
        return _lockedBalanceOf(_accountAddress);
    }

    /**
     * @notice Get details of `_accountAddress`'s lock by `_lockManager`
     * @param _accountAddress Owner of lock
     * @param _lockManager Manager of the lock for the given account
     * @return Amount of locked tokens
     * @return Amount of tokens that lock manager is allowed to lock
     */
    function getLock(address _accountAddress, address _lockManager)
        external
        view
        isInitialized
        returns (
            uint256 _amount,
            uint256 _allowance
        )
    {
        Lock storage lock_ = accounts[_accountAddress].locks[_lockManager];
        _amount = lock_.amount;
        _allowance = lock_.allowance;
    }

    /**
     * @notice Get staked and locked balances of `_accountAddress`
     * @param _accountAddress Account being requested
     * @return Amount of staked tokens
     * @return Amount of total locked tokens
     */
    function getBalancesOf(address _accountAddress) external view isInitialized returns (uint256 staked, uint256 locked) {
        staked = _totalStakedFor(_accountAddress);
        locked = _lockedBalanceOf(_accountAddress);
    }

    /**
     * @notice Get the amount of tokens staked by `_accountAddress`
     * @param _accountAddress The owner of the tokens
     * @return The amount of tokens staked by the given account
     */
    function totalStakedFor(address _accountAddress) external view isInitialized returns (uint256) {
        return _totalStakedFor(_accountAddress);
    }

    /**
     * @notice Get the total amount of tokens staked by all users
     * @return The total amount of tokens staked by all users
     */
    function totalStaked() external view isInitialized returns (uint256) {
        return _totalStaked();
    }

    /**
     * @notice Get the total amount of tokens staked by `_accountAddress` at block number `_blockNumber`
     * @param _accountAddress Account requesting for
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked by the account at the given block number
     */
    function totalStakedForAt(address _accountAddress, uint256 _blockNumber) external view isInitialized returns (uint256) {
        return accounts[_accountAddress].stakedHistory.get(_blockNumber);
    }

    /**
     * @notice Get the total amount of tokens staked by all users at block number `_blockNumber`
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked at the given block number
     */
    function totalStakedAt(uint256 _blockNumber) external view isInitialized returns (uint256) {
        return totalStakedHistory.get(_blockNumber);
    }

    /**
     * @notice Get the staked but unlocked amount of tokens by `_accountAddress`
     * @param _accountAddress Owner of the staked but unlocked balance
     * @return Amount of tokens staked but not locked by given account
     */
    function unlockedBalanceOf(address _accountAddress) external view isInitialized returns (uint256) {
        return _unlockedBalanceOf(_accountAddress);
    }

    /**
     * @notice Check if `_accountAddress`'s by `_lockManager` can be unlocked
     * @param _accountAddress Owner of lock
     * @param _lockManager Manager of the lock for the given account
     * @param _amount Amount of tokens to be potentially unlocked. If zero, it means the whole locked amount
     * @return Whether given lock of given account can be unlocked
     */
    function canUnlock(address _accountAddress, address _lockManager, uint256 _amount) external view isInitialized returns (bool) {
        return _canUnlock(_accountAddress, _lockManager, _amount);
    }

    /*
    function multicall(bytes[] _calls) public {
        for(uint i = 0; i < _calls.length; i++) {
            require(address(this).delegatecall(_calls[i]), ERROR_MULTICALL_DELEGATECALL);
        }
    }
    */

    /* Internal functions */

    function _stakeFor(address _from, address _accountAddress, uint256 _amount, bytes _data) internal {
        // staking 0 tokens is invalid
        require(_amount > 0, ERROR_AMOUNT_ZERO);

        // checkpoint updated staking balance
        uint256 newStake = _modifyStakeBalance(_accountAddress, _amount, true);

        // checkpoint total supply
        _modifyTotalStaked(_amount, true);

        // pull tokens into Staking contract
        require(stakingToken.safeTransferFrom(_from, this, _amount), ERROR_TOKEN_DEPOSIT);

        emit Staked(_accountAddress, _amount, newStake, _data);
    }

    function _unstake(address _from, uint256 _amount, bytes _data) internal {
        // checkpoint updated staking balance
        uint256 newStake = _modifyStakeBalance(_from, _amount, false);

        // checkpoint total supply
        _modifyTotalStaked(_amount, false);

        // transfer tokens
        require(stakingToken.safeTransfer(_from, _amount), ERROR_TOKEN_TRANSFER);

        emit Unstaked(_from, _amount, newStake, _data);
    }

    function _modifyStakeBalance(address _accountAddress, uint256 _by, bool _increase) internal returns (uint256) {
        uint256 currentStake = _totalStakedFor(_accountAddress);

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            require(_by <= _unlockedBalanceOf(_accountAddress), ERROR_NOT_ENOUGH_BALANCE);
            newStake = currentStake.sub(_by);
        }

        // add new value to account history
        accounts[_accountAddress].stakedHistory.add64(getBlockNumber64(), newStake);

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
        totalStakedHistory.add64(getBlockNumber64(), newStake);
    }

    function _allowManager(address _lockManager, uint256 _allowance, bytes _data) internal {
        Lock storage lock_ = accounts[msg.sender].locks[_lockManager];
        // check if lock exists
        require(lock_.allowance == 0, ERROR_LOCK_ALREADY_EXISTS);

        emit NewLockManager(msg.sender, _lockManager, _data);

        _increaseLockAllowance(_lockManager, lock_, _allowance);
    }

    function _callLockManagerCallback(uint256 _amount, address _lockManager, uint _allowance, bytes _data) internal {
        if (_toBytes4(_data) == ILockManager(_lockManager).receiveLock.selector) {
            require(ILockManager(_lockManager).receiveLock(_amount, _allowance, _data), ERROR_LOCKMANAGER_CALL_FAIL);
        }
    }

    function _increaseLockAllowance(address _lockManager, Lock storage _lock, uint256 _allowance) internal {
        require(_allowance > 0, ERROR_AMOUNT_ZERO);

        _lock.allowance = _lock.allowance.add(_allowance);

        emit LockAllowanceChanged(msg.sender, _lockManager, _allowance, true);
    }

    function _lockUnsafe(address _accountAddress, address _lockManager, uint256 _amount) internal {
        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[_lockManager];

        uint256 newAmount = lock_.amount.add(_amount);
        // check allowance is enough, it also means that lock hasn't been unlocked
        require(newAmount <= lock_.allowance, ERROR_NOT_ENOUGH_ALLOWANCE);

        lock_.amount = newAmount;

        // update total
        account.totalLocked = account.totalLocked.add(_amount);

        emit LockAmountChanged(_accountAddress, _lockManager, _amount, true);
    }

    function _unlock(address _accountAddress, address _lockManager, uint256 _amount) internal {
        Account storage account = accounts[_accountAddress];
        Lock storage lock_ = account.locks[_lockManager];

        uint256 lockAmount = lock_.amount;
        require(lockAmount >= _amount, ERROR_NOT_ENOUGH_LOCK);

        // update lock amount
        lock_.amount = lockAmount - _amount;

        // update total
        account.totalLocked = account.totalLocked.sub(_amount);

        emit LockAmountChanged(_accountAddress, _lockManager, _amount, false);
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
     * @notice Get the amount of tokens staked by `_accountAddress`
     * @param _accountAddress The owner of the tokens
     * @return The amount of tokens staked by the given account
     */
    function _totalStakedFor(address _accountAddress) internal view returns (uint256) {
        // we assume it's not possible to stake in the future
        return accounts[_accountAddress].stakedHistory.getLatestValue();
    }

    /**
     * @notice Get the total amount of tokens staked by all users
     * @return The total amount of tokens staked by all users
     */
    function _totalStaked() internal view returns (uint256) {
        // we assume it's not possible to stake in the future
        return totalStakedHistory.getLatestValue();
    }

    /**
     * @notice Get the staked but unlocked amount of tokens by `_accountAddress`
     * @param _accountAddress Owner of the staked but unlocked balance
     * @return Amount of tokens staked but not locked by given account
     */
    function _unlockedBalanceOf(address _accountAddress) internal view returns (uint256) {
        uint256 unlockedTokens = _totalStakedFor(_accountAddress).sub(accounts[_accountAddress].totalLocked);

        return unlockedTokens;
    }

    function _lockedBalanceOf(address _accountAddress) internal view returns (uint256) {
        return accounts[_accountAddress].totalLocked;
    }

    /**
     * @notice Check if `_accountAddress`'s by `_lockManager` can be unlocked
     * @param _accountAddress Owner of lock
     * @param _lockManager Manager of the lock for the given account
     * @return Whether given lock of given account can be unlocked
     */
    function _canUnlock(address _accountAddress, address _lockManager, uint256 _amount) internal view returns (bool) {
        Lock storage lock_ = accounts[_accountAddress].locks[_lockManager];
        require(lock_.allowance > 0, ERROR_LOCK_DOES_NOT_EXIST);
        require(lock_.amount >= _amount, ERROR_NOT_ENOUGH_LOCK);

        uint256 amount = _amount == 0 ? lock_.amount : _amount;

        if (msg.sender == _lockManager ||
            (msg.sender == _accountAddress && (amount == 0 || ILockManager(_lockManager).canUnlock(_accountAddress, amount)))) {
            return true;
        }

        return false;
    }

    function _toBytes4(bytes memory _data) internal pure returns (bytes4 result) {
        if (_data.length < 4) {
            return bytes4(0);
        }

        assembly { result := mload(add(_data, 0x20)) }
    }
}
