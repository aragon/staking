# Data structures

## Account

It stores all the information related to users:

- `locks`: A mapping from manager to Lock (see below). So there will be an entry for each manager locking tokens of this account owner
- `totalLocked`: the current total amount of tokens locked by all the managers
- `stakedHistory`: link to the Checkpointing library to keep staking history

## Lock

Stores the information for a particular pair of owner and manager:

- `amount`: The currently locked amount
- `allowance`: The maximum amount that lock manager can lock for the owner of the lock. Must be greater than zero to consider the lock active, and always greater than or equal to amount

