const TruffleConfig = require('@aragon/truffle-config-v5/truffle-config')

TruffleConfig.compilers.solc.version = '0.5.17'
TruffleConfig.compilers.solc.settings.optimizer.runs = 10000
TruffleConfig.plugins = ["solidity-coverage"]

module.exports = TruffleConfig

