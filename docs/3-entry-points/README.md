# Entry points

### initialize

This is used by the Staking Factory when creating a new proxy. See deployment section for more details.

- **Actor:** Deployer account
- **Inputs:**
  - **_stakingToken: ** ERC20 token to be used for staking
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that input token is a contract
- **State transitions:**
  - Sets the staking token
  - Marks the contract as initialized


## Staking ERC900 interface

### stake

Stakes `_amount` tokens, transferring them from `msg.sender`

- **Actor:** Staking user
- **Inputs:**
  - **_amount:** Number of tokens staked
  - **_data:** Used in Staked event, to add signalling information in more complex staking applications
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount is not zero
- **State transitions:**
  - Transfers tokens from sender to contract
  - Increments sender’s balance
  - Increments total balance

### stakeFor

Stakes `_amount` tokens, transferring them from caller, and assigns them to `_accountAddress`

- **Actor:** Staking user
- **Inputs:**
  - **_accountAddress:** The final staker of the tokens
  - **_amount:** Number of tokens staked
  - **_data:** Used in Staked event, to add signalling information in more complex staking applications
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount is not zero
- **State transitions:**
  - Transfers tokens from sender to contract
  - Increments final recipient’s balance
  - Increments total balance


### unstake

Unstakes `_amount` tokens, returning them to the user

- **Actor:** Staking user
- **Inputs:**
  - **_amount:** Number of tokens to unstake
  - **_data:** Used in Unstaked event, to add signalling information in more complex staking applications
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount is not zero
- **State transitions:**
  - Transfers tokens from contract to sender
  - Decrements user’s balance
  - Decrements total balance


### token

Get the token used by the contract for staking and locking

- **Actor:** Any
- **Outputs:**
  - Address of the staking token
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized


### supportsHistory

It returns true, as it supports history of stakes

- **Actor:** Any
- **Outputs:**
  - true
- **Authentication:** Open


### lastStakedFor

Get last time `_accountAddress` modified its staked balance

- **Actor:** Any
- **Inputs:**
  - **_accountAddress:** Account requesting for
- **Outputs:**
  - Last block number when account’s balance was modified
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized


### totalStakedForAt

Get the total amount of tokens staked by `_accountAddress` at block number `_blockNumber`

- **Actor:** Any
- **Inputs:**
  - **_accountAddress:** Account requesting for
  - **_blockNumber:** Block number at which we are requesting
- **Outputs:**
  - The amount of tokens staked by the account at the given block number
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized


### totalStakedAt

Get the total amount of tokens staked by all users at block number `_blockNumber`

- **Actor:** Any
- **Inputs:**
  - **_blockNumber:** Block number at which we are requesting
- **Outputs:**
  - The amount of tokens staked at the given block number
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized


### totalStakedFor

Get the amount of tokens staked by `_accountAddress`

- **Actor:** Any
- **Inputs:**
  - **_accountAddress:** Account requesting for
- **Outputs:**
  - The amount of tokens staked by the given account
- **Authentication:** Open
- **Pre-flight checks:**
  - None: TODO

### totalStaked

Get the total amount of tokens staked by all users

- **Actor:** Any
- **Outputs:**
  - The total amount of tokens staked by all users
- **Authentication:** Open
- **Pre-flight checks:**
  - None: TODO


## Locking

### allowManager

Allow `_lockManager` to lock up to `_allowance` tokens of `msg.sender`
It creates a new lock, so the lock for this manager cannot exist before.

- **Actor:** Staking user
- **Inputs:**
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of tokens that the manager can lock
  - **_data:** Used in `NewLockManager` event and to parametrize logic for the lock to be enforced by the manager
- **Authentication:** Open. Implicitly, sender must be staking owner.
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that allowance input is not zero
  - Checks that lock didn’t exist before
- **State transitions:**
  - Sets allowance for the pair owner-manager to the given amount
  - Calls lock manager callback

### allowManagerAndLock

Lock `_amount` staked tokens and assign `_lockManager` as manager with `_allowance` allowed tokens and `_data` as data, so they can not be unstaked

- **Actor:** Staking user
- **Inputs:**
  - **_amount:** The amount of tokens to be locked
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of tokens that the manager can lock
  - **_data:** Used in `NewLockManager` event and to parametrize logic for the lock to be enforced by the manager
- **Authentication:** Open. Implicitly, sender must be staking owner.
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that allowance input is not zero
  - Checks that lock didn’t exist before
  - Checks that amount input is not zero
  - Checks that user has enough unlocked tokens available
  - Checks that amount is not greater than allowance
- **State transitions:**
  - Sets allowance for the pair owner-manager to the given amount
  - Sets the amount of tokens as locked by the manager
  - Increases the total amount of locked tokens balance for the user
  - Calls lock manager callback


### transfer

Transfer `_amount` tokens to `_to``_toLockManager != 0 ? '\'s lock ' + _toLockManager : ''`

- **Actor:** 
- **Inputs:**
  - **_to:** 
  - **_toLockManager:** 
  - **_amount:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### slash

Transfer `_amount` tokens from `_from`'s lock by `msg.sender` to `_to``_toLockManager > 0 ? '\'s lock by ' + _toLockManager : ''`

- **Actor:** 
- **Inputs:**
  - **_from:** 
  - **_to:** 
  - **_toLockManager:** 
  - **_amount:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### slashAndUnlock

Transfer `@tokenAmount(stakingToken: address, _transferAmount)` from `_from`'s lock by `msg.sender` to `_to`, and decrease `@tokenAmount(stakingToken: address, _decreaseAmount)` from that lock

- **Actor:** 
- **Inputs:**
  - **_from:** 
  - **_to:** 
  - **_decreaseAmount:** 
  - **_transferAmount:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### increaseLockAllowance

Increase allowance in `@tokenAmount(stakingToken: address, _allowance)` of lock manager `_lockManager` for user `msg.sender`

- **Actor:** 
- **Inputs:**
  - **_lockManager:** 
  - **_allowance:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### decreaseLockAllowance

Decrease allowance in `@tokenAmount(stakingToken: address, _allowance)` of lock manager `_lockManager` for user `_accountAddress`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_lockManager:** 
  - **_allowance:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### lock

Increase locked amount by `@tokenAmount(stakingToken: address, _amount)` for user `_accountAddress` by lock manager `_lockManager`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_lockManager:** 
  - **_amount:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### unlock

Decrease locked amount by `@tokenAmount(stakingToken: address, _amount)` for user `_accountAddress` by lock manager `_lockManager`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_lockManager:** 
  - **_amount:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### unlockAndRemoveManager

Unlock `_accountAddress`'s lock by `_lockManager` so locked tokens can be unstaked again

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_lockManager:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### setLockManager

Change the manager of `_accountAddress`'s lock from `msg.sender` to `_newLockManager`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_newLockManager:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### getTotalLockedOf

Get total amount of locked tokens for `_accountAddress`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** ) → uint25
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### getLock

Get details of `_accountAddress`'s lock by `_lockManager`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_lockManager:** ) → uint256 _amount, uint256 _allowanc
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### getBalancesOf

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** ) → uint256 staked, uint256 locke
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### unlockedBalanceOf

Get the staked but unlocked amount of tokens by `_accountAddress`

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** ) → uint25
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


### canUnlock

Check if `_accountAddress`'s by `_lockManager` can be unlocked

- **Actor:** 
- **Inputs:**
  - **_accountAddress:** 
  - **_lockManager:** 
  - **_amount:** ) → boo
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


## MiniMe callback

### receiveApproval

MiniMeToken ApproveAndCallFallBack compliance

- **Actor:** 
- **Inputs:**
  - **_from:** 
  - **_amount:** 
  - **_token:** 
  - **_data:** 
- **Authentication:** 
- **Pre-flight checks:**
- **State transitions:**


