# Staking App

A Staking app with checkpointing (implementing ERC900 interface with history) and locking.

## Testing
### Embark

Currently this app is using Embark. You can use it to test with `npm run test`.

### Truffle

To test using truffle you can run `npm run test:truffle`. This will first convert scripts into `test_truffle` folder.

###  Slither
[Install slither](https://github.com/trailofbits/slither#how-to-install) and then:
```
slither --solc /usr/local/bin/solc .
```

Some noise can be filtered with:
```
slither --solc /usr/local/bin/solc .  2>/tmp/a.txt ; grep -v "is not in mixedCase"  /tmp/a.txt | grep "Contract: Staking"
```

### Echidna
Run `./scripts/flatten_echidna.sh` and then:
```
docker run -v `pwd`:/src trailofbits/echidna echidna-test /src/flattened_contracts/EchidnaStaking.sol EchidnaStaking --config="/src/echidna/config.yaml"
```

### Manticore
```
docker run --rm -ti -v `pwd`:/src trailofbits/manticore bash
ulimit -s unlimited
manticore --detect-all --contract Staking /src/flattened_contracts/Staking.sol
```

## Coverage
Currently coverage doesn't work with Embark (see [this issue](https://github.com/embark-framework/embark/issues/1115)). So you have to use truffle scripts. After having run previous truffle test command (or `./scripts/truffleit.sh`), use `npm run coverage:truffle`.
