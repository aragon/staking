# External interface

### Initialize

- **Name:** initialize
- **Inputs:**
  - **_stakingToken:** ERC20 token to be used for staking


## Staking ERC900 interface

### Stake

- **Name:** stake
- **Inputs:**
  - **_amount:** Number of tokens staked
  - **_data:** Used in Staked event, to add signalling information in more complex staking applications

### Stake for

- **Name:** stakeFor
- **Inputs:**
  - **_user:** The final staker of the tokens
  - **_amount:** Number of tokens staked
  - **_data:** Used in Staked event, to add signalling information in more complex staking applications

### Unstake

- **Name:** unstake
- **Inputs:**
  - **_amount:** Number of tokens to unstake
  - **_data:** Used in Unstaked event, to add signalling information in more complex staking applications

### Token

- **Name:** token
- **Outputs:**
  - Address of the staking token

### Supports history

- **Name:** supportsHistory
- **Outputs:**
  - true

### Last staked for

- **Name:** lastStakedFor
- **Inputs:**
  - **_user:** Account requesting for
- **Outputs:**
  - Last block number when account’s balance was modified

### Total staked for at

- **Name:** totalStakedForAt
- **Inputs:**
  - **_user:** Account requesting for
  - **_blockNumber:** Block number at which we are requesting
- **Outputs:**
  - The amount of tokens staked by the account at the given block number

### Total staked at

- **Name:** totalStakedAt
- **Inputs:**
  - **_blockNumber:** Block number at which we are requesting
- **Outputs:**
  - The amount of tokens staked at the given block number

### Total staked for

- **Name:** totalStakedFor
- **Inputs:**
  - **_user:** Account requesting for
- **Outputs:**
  - The amount of tokens staked by the given account

### Total staked

- **Name:** totalStaked
- **Outputs:**
  - The total amount of tokens staked by all users

## Locking interface

### Allow new manager

- **Name:** allowManager
- **Inputs:**
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of tokens that the manager can lock
  - **_data:** Used in `NewLockManager` event and to parametrize logic for the lock to be enforced by the manager

### Transfer

- **Name:** transfer
- **Inputs:**
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred

### Transfer and unstake

- **Name:** transferAndUnstake
- **Inputs:**
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred

### Slash

- **Name:** slash
- **Inputs:**
  - **_from:** Owner of locked tokens
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred

### Slash and unstake

- **Name:** slashAndUnstake
- **Inputs:**
  - **_from:** Owner of locked tokens
  - **_to:** Recipient of the tokens
  - **_amount:** Number of tokens to be transferred

### Slash and unlock

- **Name:** slashAndUnlock
- **Inputs:**
  - **_from:** Owner of locked tokens
  - **_to:** Recipient of the tokens
  - **_unlockAmount:** Number of tokens to be unlocked
  - **_slashAmount:** Number of tokens to be transferred

### Increase lock allowance

- **Name:** increaseLockAllowance
- **Inputs:**
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of allowed tokens increase

### Decrease lock allowance

- **Name:** decreaseLockAllowance
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_lockManager:** The manager entity for this particular lock
  - **_allowance:** Amount of allowed tokens decrease

### Lock

- **Name:** lock
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_amount:** Amount of locked tokens increase

### Unlock

- **Name:** unlock
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_lockManager:** The manager entity for this particular lock
  - **_amount:** Amount of locked tokens decrease

### Unlock and remove manager

- **Name:** unlockAndRemoveManager
- **Inputs:**
  - **_user:** Owner of locked tokens
  - **_lockManager:** The manager entity for this particular lock

### Get total locked of

- **Name:** getTotalLockedOf
- **Inputs:**
  - **_user:** Owner of locks
- **Outputs:**
  - Total amount of locked tokens for the requested account


### Get lock

- **Name:** getLock
- **Inputs:**
  - **_user:** Owner of lock
  - **_lockManager:** Manager of the lock for the given account
- **Outputs:**
  - **_amount:** Amount of locked tokens
  - **_allowance:** Amount of tokens that lock manager is allowed to lock


### Get balances of

- **Name:** getBalancesOf
- **Inputs:**
  - **_user:** Account being requested
- **Outputs:**
  - **staked:** Amount of staked tokens
  - **locked:** Amount of total locked tokens


### Unlocked balance of

- **Name:** unlockedBalanceOf
- **Inputs:**
  - **_user:** Owner of the staked but unlocked balance
- **Outputs:**
  - Amount of tokens staked but not locked by given account


### Can unlock

- **Name:** canUnlock
- **Inputs:**
  - **_user:** Owner of lock
  - **_lockManager:** Manager of the lock for the given account
  - **_amount:** Amount of tokens to be potentially unlocked. If zero, it means the whole locked amount
- **Outputs:**
  - True if caller is allowed to unlock the requested amount (all the lock if amount requested is zero)

## MiniMe callback

### Receive approval

- **Name:** receiveApproval
- **Inputs:**
  - **_from:** Account approving tokens
  - **_amount:** Amount of `_token` tokens being approved
  - **_token:** MiniMeToken that is being approved and that the call comes from
  - **_data:** Used in Staked event, to add signalling information in more complex staking applications


