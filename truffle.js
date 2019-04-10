module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
      gas: 6e6
    },
  },
  compilers: {
    solc: {
      version: '0.5.3',
      settings: {
        optimizer: {
          enabled: false,
          runs: 10000
        },
        evmVersion: 'constantinople'
      }
    }
  }
}
