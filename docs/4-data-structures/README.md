# Data structures

## Account

It stores all the information related to users:

- `locks`: A mapping from lock manager to Locks (see below). There will be an entry for each manager locking tokens for this user.
- `totalLocked`: The current total amount of tokens locked by all lock managers for this user
- `stakedHistory`: Checkpointing storage for staked balance history

## Lock

Stores the information for a particular owner-manager pair:

- `amount`: The currently locked amount
- `allowance`: The maximum amount that the lock manager can lock for the owner. Must be greater than zero to consider the lock active, and always greater than or equal to the currently locked amount.
