# Testing guide

// Note: what would go here? Install and run tests?
TODO

## Echidna

You can run some fuzzing tests with [Echidna](https://github.com/crytic/echidna) using the following commands:

```
mkdir -p flattened_contracts
npx truffle-flattener contracts/test/EchidnaStaking.sol > flattened_contracts/EchidnaStaking.sol
docker run -ti -v `pwd`:/src trailofbits/eth-security-toolbox
```

And then inside the container:

// Note: we should update these for 0.5.17, any other changes?
```
solc-select 0.4.24
echidna-test /src/flattened_contracts/EchidnaStaking.sol --contract EchidnaStaking --config /src/echidna/config.yaml
```
