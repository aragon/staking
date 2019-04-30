const flatten = require('./helpers/flatten')

module.exports = async () => {
  console.log(0)
  const EchidnaStaking = artifacts.require('EchidnaStaking')
  console.log(1)
  const echidnaStaking = await EchidnaStaking.new()
  //console.log(echidnaStaking.constructor._json)
  console.log(2, echidnaStaking.address)
  await flatten(echidnaStaking)
}
