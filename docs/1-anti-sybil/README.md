# Anti-sybil

Staking app uses the [Checkpointing library](https://github.com/aragon/aragon-apps/pull/415) to provide a history of balances within the app. This is important for applications such as token-weighted voting, as one token could potentially be used to vote more than once if it’s transferred to another account after being used to cast a vote. Mimicing the [MiniMe token](https://github.com/Giveth/minime), checkpointing allows to have a snapshot of balances at any given used time, that can be used to tally votes.

Any time that there is a balance change in the Staking app, the Checkpointing library stores the timestamp and value in an array for the balance owner. Balance changes are stored in natural time order, meaning that it’s not possible to modify a balance nor add a checkpoint in the past.

One important technical detail to note is that in order to save gas (Checkpointing is an expensive operation), timestamp and value are stored together in one slot, so the maximum amount that can be stored is `2^192 - 1`, which may break compatibility with common ERC-20 tokens and be problematic in some edge-cases.

There is also a history array for the total staked in the app.

