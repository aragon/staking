# Entry points

Funds flows with the same origin and destiny:

| From   | To     | Name    |
|--------|--------|---------|
| Wallet | Stake  | stake   |
| Stake  | Wallet | unstake |
| Stake  | Lock   | lock    |
| Lock   | Stake  | unlock  |

Funds flows with different origin and destiny:


| From   | To     | Name               |
|--------|--------|--------------------|
| Wallet | Stake  | stakeFor           |
| Stake  | Stake  | transfer           |
| Stake  | Wallet | transferAndUnstake |
| Lock   | Stake  | slash              |
| Lock   | Wallet | slashAndUnstake    |

### initialize

This is used by the Staking Factory when creating a new proxy. See deployment section for more details.

- **Actor:** Deployer account
- **Inputs:**
  - **_stakingToken:** ERC20 token to be used for staking
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

Stakes `_amount` tokens, transferring them from `msg.sender`, and assigns them to `_user`

- **Actor:** Staking user
- **Inputs:**
  - **_user:** The receiving account for the tokens staked
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

Get last time `_user` modified its staked balance

- **Actor:** Any
- **Inputs:**
  - **_user:** Account requesting for
- **Outputs:**
  - Last block number when account’s balance was modified
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized


### totalStakedForAt

Get the total amount of tokens staked by `_user` at block number `_blockNumber`

- **Actor:** Any
- **Inputs:**
  - **_user:** Account requesting for
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

Get the amount of tokens staked by `_user`

- **Actor:** Any
- **Inputs:**
  - **_user:** Account requesting for
- **Outputs:**
  - The amount of tokens staked by the given account
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized

### totalStaked

Get the total amount of tokens staked by all users

- **Actor:** Any
- **Outputs:**
  - The total amount of tokens staked by all users
- **Authentication:** Open
- **Pre-flight checks:**
  - Checks that contract has been initialized


## Locking interface

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


### transfer

Transfer `_amount` tokens to `_to`’s staked balance

- **Actor:** Staking user (owner)
- **Inputs:**
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred
- **Authentication:** Open. Implicitly, sender must be staking owner.
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount input is not zero
  - Checks that user has enough unlocked tokens available
- **State transitions:**
  - Decreases sender balance
  - Increases recipient balance

### transferAndUnstake

Transfer `_amount` tokens to `_to`’s external balance (i.e. unstaked)

- **Actor:** Staking user (owner)
- **Inputs:**
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred
- **Authentication:** Open. Implicitly, sender must be staking owner.
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount input is not zero
  - Checks that user has enough unlocked tokens available
- **State transitions:**
  - Decreases sender balance
  - Makes a token transfer from Stakig to recipient’s account
  - Decreases Staking total balance

### slash

Transfer `_amount` tokens from `_from`'s lock by `msg.sender` to `_to`

- **Actor:** Lock manager
- **Inputs:**
  - **_from:** Owner of locked tokens
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred
- **Authentication:** Open. Implicitly, sender must be lock manager.
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Check that owner’s lock is enough
  - Checks that amount input is not zero
- **State transitions:**
  - Decreases owner’s locked amount for the calle lock manager
  - Decreases owner’s total locked amount
  - Decreases owner balance
  - Increases recipient balance

### slashAndUnstake

Transfer `_amount` tokens from `_from`'s lock by `msg.sender` to `_to`’s external wallet (unstaked)

- **Actor:** Lock manager
- **Inputs:**
  - **_from:** Owner of locked tokens
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred
- **Authentication:** Open. Implicitly, sender must be lock manager
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Check that owner’s lock is enough
  - Checks that amount input is not zero
- **State transitions:**
  - Decreases owner’s locked amount for the caller lock manager
  - Decreases owner’s total locked amount
  - Decreases owner balance
  - Makes a token transfer from Stakig to recipient’s account
  - Decreases Staking total balance

### slashAndUnlock

Transfer `_transferAmount` tokens from `_from`'s lock by `msg.sender` to `_to`, and decrease `_decreaseAmount` tokens from that lock

- **Actor:** Lock manager
- **Inputs:**
  - **_from:** Owner of locked tokens
  - **_to:** Recipient of the tokens
  - **_unlockAmount:** Number of tokens to be unlocked
  - **_slashAmount:** Number of tokens to be transferred
- **Authentication:** Open. Implicitly, sender must be lock manager
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Check that owner’s lock is enough
  - Checks that unlock amount input is not zero
  - Checks that slash amount input is not zero
- **State transitions:**
  - Decreases owner’s locked amount for the caller lock manager by both input amounts
  - Decreases owner’s total locked amount by both input amounts
  - Decreases owner balance by slash amount
  - Increases recipient balance by slash amount


### increaseLockAllowance

Increase allowance in `_allowance` tokens of lock manager `_lockManager` for user `msg.sender`

- **Actor:** Staking user (owner)
- **Inputs:**
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of allowed tokens increase
- **Authentication:** Open. Implicitly, sender must be staking owner.
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that lock exists (i.e., it has a previous allowance)
  - Checks that amount input is not zero
- **State transitions:**
  - Increases lock allowance for this pair of owner and lock manager

### decreaseLockAllowance

Decrease allowance in `_allowance` tokens of lock manager `_lockManager` for user `_user`

- **Actor:** Staking user (owner) or lock manager
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of allowed tokens decrease
- **Authentication:** Only owner or lock manager
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount input is not zero
  - Checks that lock exists (i.e., it has a previous allowance)
  - Checks that final allowed amount is not less than currently locked tokens
  - Checks that final allowed result is not zero (unlockAndRemoveManager must be used for this)
- **State transitions:**
  - Decreases lock allowance for this pair of owner and lock manager


### lock

Increase locked amount by `_amount` tokens for user `_user` by lock manager `msg.sender`

- **Actor:** Lock manager
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_amount:** Amount of locked tokens increase
- **Authentication:** Only owner or lock manager
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount input is not zero
  - Checks that user has enough unlocked tokens available
  - Checks that lock has enough allowance
- **State transitions:**
  - Increases locked tokens for this pair of owner and lock manager
  - Increases owner’s total locked tokens

### unlock

Decrease locked amount by `_amount` tokens for user `_user` by lock manager `_lockManager`

- **Actor:** Staking user (owner) or lock manager
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_lockManager:** The manager entity for this particular lock
  - **_amount:** Amount of locked tokens decrease
- **Authentication:** Only owner or lock manager
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that amount input is not zero
  - Checks that lock exists (i.e., it has a previous allowance)
  - Checks that user has enough unlocked tokens available
  - If sender is owner, checks that manager allows to unlock
- **State transitions:**
  - Decreases locked tokens for this pair of owner and lock manager
  - Decreases owner’s total locked tokens


### unlockAndRemoveManager

Unlock `_user`'s lock by `_lockManager` so locked tokens can be unstaked again

- **Actor:** Staking user (owner) or lock manager
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_lockManager:** The manager entity for this particular lock
- **Authentication:** Only owner or lock manager
- **Pre-flight checks:**
  - Checks that contract has been initialized
  - Checks that lock exists (i.e., it has a previous allowance)
  - If sender is owner and there were locked tokens, checks that manager allows to unlock
- **State transitions:**
  - Decreases owner’s total locked amount by currently locked tokens for this lock manager
  - Deletes lock for this pair of owner and lock manager

### getTotalLockedOf

Get total amount of locked tokens for `_user`

- **Actor:** Any
- **Inputs:**
  - **_user:** Owner of locks
- **Outputs:**
  - Total amount of locked tokens for the requested account
- **Authentication:** Open


### getLock

Get details of `_user`'s lock by `_lockManager`

- **Actor:** Any
- **Inputs:**
  - **_user:** Owner of lock
  - **_lockManager:** Manager of the lock for the given account
- **Outputs:**
  - **_amount:** Amount of locked tokens
  - **_allowance:** Amount of tokens that lock manager is allowed to lock
- **Authentication:** Open


### getBalancesOf

Get staked and locked balances of `_user`

- **Actor:** Any
- **Inputs:**
  - **_user:** Account being requested
- **Outputs:**
  - **staked:** Amount of staked tokens
  - **locked:** Amount of total locked tokens
- **Authentication:** Open


### unlockedBalanceOf

Get the staked but unlocked amount of tokens by `_user`

- **Actor:** Any
- **Inputs:**
  - **_user:** Owner of the staked but unlocked balance
- **Outputs:**
  - Amount of tokens staked but not locked by given account
- **Authentication:** Open


### canUnlock

Check if `_user`'s by `_lockManager` can be unlocked by `_sender`

- **Actor:** Any
- **Inputs:**
  - **_sender:** Account that would try to unlock tokens
  - **_user:** Owner of lock
  - **_lockManager:** Manager of the lock for the given owner
  - **_amount:** Amount of tokens to be potentially unlocked. If zero, it means the whole locked amount
- **Outputs:**
  - True if caller is allowed to unlock the requested amount (all the lock if amount requested is zero)
- **Authentication:** Open
- **Pre-flight checks:**
  - It will revert if the lock doesn’t exist or if the requested amount is greater than the lock.

## MiniMe callback

### receiveApproval

MiniMeToken ApproveAndCallFallBack compliance

- **Actor:** Staking token
- **Inputs:**
  - **_from:** Account approving tokens
  - **_amount:** Amount of `_token` tokens being approved
  - **_token:** MiniMeToken that is being approved and that the call comes from
  - **_data:** Used in Staked event, to add signalling information in more complex staking applications
- **Authentication:** It must be called by the staking token
- **Pre-flight checks:**
  - Check that `_token` parameter, Staking token and caller are all the same
- **State transitions:**
  - Transfers tokens from `_from` account to contract
  - Increments `_from` account’s balance
  - Increments total balance


