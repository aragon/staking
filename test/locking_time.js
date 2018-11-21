const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
const TimeLockManagerMock = embark.require('Embark/contracts/TimeLockManagerMock');

let accounts

config({}, (err, accts) => {
  accounts = accts
})

contract('Staking app - Time locking', () => {
  let token, staking, manager, owner, other

  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  const defaultAmount = 100
  const defaultTime = 1000
  const defaultBlocks = 10

  const approveAndStake = async(amount = defaultAmount) => {
    await token.methods.approve(staking.options.address, amount).send()
    await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
  }

  const timeSpanToData = (unit, start, end) => {
    return "0x" +
      unit.toString().padStart(64, "0") +
      web3.utils.fromDecimal(start).slice(2).padStart(64, "0") +
      web3.utils.fromDecimal(end).slice(2).padStart(64, "0")
  }
  const timeToData = (start, end) => {
    return timeSpanToData(TIME_UNIT_SECONDS, start, end)
  }
  const blocksToData = (start, end) => {
    return timeSpanToData(TIME_UNIT_BLOCKS, start, end)
  }

  const approveStakeAndLock = async(data, lockAmount = defaultAmount / 2, stakeAmount = defaultAmount) => {
    await approveAndStake(stakeAmount)
    const r = await staking.methods.lock(lockAmount, manager.options.address, data).send()
    const lockId = getEvent(r, 'Locked', 'lockId')

    return lockId
  }

  before(async () => {
    owner = accounts[0]
    other = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = web3.utils.toWei('1000', 'ether')
    token = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    staking = await Staking.deploy({arguments: [token.options.address]}).send()
    manager = await TimeLockManagerMock.deploy().send()
  })

  it('locks using seconds', async () => {
    const startTime = await manager.methods.getTimestampExt().call()
    const endTime = parseInt(startTime, 10) + defaultTime
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const lock = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), (await manager.methods.MAX_UINT64().call()).toString(), "unlock time should match")
    assert.equal(lock[2], manager.options.address, "unlocker should match")
    assert.equal(lock[3], data, "lock data should match")

    // can not unlock
    assert.equal(await staking.methods.canUnlock(owner, lockId).call(), false, "Shouldn't be able to unlock")
    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")

    await manager.methods.setTimestamp(endTime + 1).send()
    // can unlock
    assert.equal(await staking.methods.canUnlock(owner, lockId).call(), true, "Should be able to unlock")
    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
  })

  it('locks using blocks', async () => {
    const startBlock = (await manager.methods.getBlockNumberExt().call())
    const endBlock = parseInt(startBlock, 10) + defaultBlocks
    const data = blocksToData(startBlock, endBlock)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const lock = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), (await manager.methods.MAX_UINT64().call()).toString(), "unlock time should match")
    assert.equal(lock[2], manager.options.address, "unlocker should match")
    assert.equal(lock[3], data, "lock data should match")

    // can not unlock
    assert.equal(await staking.methods.canUnlock(owner, lockId).call(), false, "Shouldn't be able to unlock")
    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")

    await manager.methods.setBlockNumber(endBlock + 1).send()
    // can unlock
    assert.equal(await staking.methods.canUnlock(owner, lockId).call(), true, "Should be able to unlock")
  })

  it('fails to unlock if can not unlock', async () => {
    const startTime = await manager.methods.getTimestampExt().call()
    const endTime = parseInt(startTime, 10) + defaultTime
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // tries to unlock
    return assertRevert(async () => {
      await staking.methods.unlock(owner, lockId).send()
    })
  })

  it('changes lock data', async () => {
    const startTime = await manager.methods.getTimestampExt().call()
    const endTime = parseInt(startTime, 10) + defaultTime
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const lock = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock[3], data, "lock data should match")

    // can not unlock
    assert.equal(await staking.methods.canUnlock(owner, lockId).call(), false, "Shouldn't be able to unlock")

    // change data
    const startTime2 = parseInt(await manager.methods.getTimestampExt().call(), 10) - 2
    const endTime2 = startTime2 + 1
    const data2 = timeToData(startTime2, endTime2)
    await manager.methods.setLockData(staking.options.address, owner, lockId, data2).send()


    // check lock values
    const lock2 = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock2[3], data2, "lock data should match")

    // can unlock
    assert.equal(await staking.methods.canUnlock(owner, lockId).call(), true, "Should be able to unlock")
  })
})
