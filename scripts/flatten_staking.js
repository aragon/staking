const flatten = require('./helpers/flatten')

module.exports = async () => {
  const Token = artifacts.require('StandardTokenMock')
  const token = await Token.new('0x0', 0)
  const Staking = artifacts.require('Staking')
  const staking = await Staking.new(token.address)
  await flatten(staking)
}
