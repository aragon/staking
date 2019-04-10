const Staking = artifacts.require('Staking')
const StakingFactory = artifacts.require('StakingFactory')
const StandardTokenMock = artifacts.require('StandardTokenMock')

contract('StakingFactory', ([owner]) => {
  let token, factory, staking

  beforeEach('deploy sample token and staking factory', async () => {
    token = await StandardTokenMock.new(owner, 100000, { from: owner })
    factory = await StakingFactory.new()
  })

  it('creates staking instances', async () => {
    const expectedInstanceAddress = await factory.addressFor(token.address)

    const receipt = await factory.instanceFor(token.address)

    const events = receipt.logs.filter(l => l.event === 'NewStaking')
    assert.equal(events.length, 1, 'number of NewStaking events does not match')
    assert.equal(events[0].args.instance, expectedInstanceAddress, 'instance address does not match')
    assert.equal(events[0].args.token, token.address, 'token address does not match')

    const instanceAddress = events[0].args.instance
    const baseImplementation = await web3.eth.getStorageAt(factory.address, 0x0)
    const proxiedImplementation = await web3.eth.getStorageAt(instanceAddress, web3.utils.sha3('aragon.network.staking'))
    assert.equal(baseImplementation, proxiedImplementation, 'staking implementations do not match')

    staking = await Staking.at(expectedInstanceAddress)
    assert.equal(await staking.token(), token.address, 'token address does not match')
  })
})
