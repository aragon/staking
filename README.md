# Staking App

A Staking app with checkpointing (implementing ERC900 interface with history) and locking.

## Testing
### Truffle

Currently this app is using Truffle. You can run tests with `npm test`.

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
You can measure coverage using Truffle by running `npm run coverage`.
