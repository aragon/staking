# Locking and Slashing

The ERC900 standard doesn’t define what can happen once someone has staked their tokens. Many use cases need to be able to slash users’ tokens 
depending on the outcome of certain actions. A lot of interesting applications for staking tokens are built on the fact that a part or the 
totality of one’s tokens could potentially be lost if they were to act in a bad way. For example, in the case of the [Agreement app](https://github.com/aragon/aragon-apps/tree/master/apps/agreement), 
proposed actions can be challenged and depending on how the challenge is resolved, the user could lose the staked collateral.

Staking app achieves this by adding locks on top of staked balances. A user can designate multiple lock managers, which can be either a contract 
or an `EOA`, and a maximum allowance for each manager. The managers will then be able to lock up to that allowed amount of tokens, and to unlock 
them too. While the tokens are locked, the original owner cannot unstake nor transfer them, but the lock manager is allowed to transfer them 
wherever is needed: to another user’s lock, to the staked balance of another user, or to an external account.

If the manager is a contract, it must implement the [`canUnlock`](../../contracts/locking/ILockManager.sol#L11) method, where certain conditions 
can be specified to allow the owner to re-gain control of the tokens. A common use case would be a [time based lock manager](../../contracts/locking/TimeLockManager.sol), 
that would lock tokens only for a defined period of time, and once the period is over, the user would be able to unlock his tokens.
