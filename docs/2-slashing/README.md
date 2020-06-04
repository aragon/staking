# Slashing

Many use cases need to be able to slash users’ tokens depending on the outcome of certain actions. For instance, when proposing an action in the Agreements app, if it’s challenged and the [Aragon Court](https://court.aragon.org/dashboard) resolves to accept the challenge, user would lose the staked collateral.

Staking app achieves this by adding locks on top of staked balances. A user can designate a lock manager, which can be either a contract or an `EOA`, and a maximum allowance for that manager. The manager then will be able to lock up to that allowed amount of tokens, and to unlock them too. While the tokens are locked, the original owner cannot unstake them, while the manager can transfer to wherever is needed: another user’s lock, the staked balance of another user, or even the external token balance of another account.

If the manager is a contract, it must implement the method `canUnlock`, where certain conditions can be specified to allow the owner to re-gain control of the tokens. A common use case would be a time based lock manager, that would lock tokens only for some period, and once the period is over, the user would be able to unlock and unstake the tokens.

