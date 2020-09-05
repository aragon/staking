Staking complies with the [ERC900 interface](https://eips.ethereum.org/EIPS/eip-900) with the following added features:

- Anti-sybil protection
- Locking-slashing mechanism

The main motivation is to be used in conjunction with [Agreements](https://github.com/aragon/aragon-apps/tree/master/apps/agreement) in the context of the Aragon Network, but it has been designed to be as generic as possible, in order to allow for other use cases too.

More discussion behind our motivations and use cases are available [here](https://forum.aragon.org/t/staking-locks-spec-v2/217).

## Table of Contents

1. [Anti-sybil protection](./1-anti-sybil)
2. [Locking-slashing mechanism](./2-locking-slashing)
3. [Entry points](./3-entry-points)
4. [Data structures](./4-data-structures)
5. [External interface](./5-external-interface)
6. [Deployment](./6-deployment)
7. [Testing guide](./7-testing-guide)

