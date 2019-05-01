const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event === event)[0].args[arg] }

const Staking = artifacts.require('Staking');
const StakingFactory = artifacts.require('StakingFactory');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const TimeLockManagerMock = artifacts.require('TimeLockManagerMock');

const fromBn = n => parseInt(n.valueOf(), 10)

contract('Staking app, Time locking', ([owner]) => {
  let token, staking, manager

  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  const DEFAULT_AMOUNT = 120
  const DEFAULT_TIME = 1000
  const DEFAULT_BLOCKS = 10
  const EMPTY_STRING = ''

  const approveAndStake = async(amount = DEFAULT_AMOUNT) => {
    await token.approve(staking.address, amount)
    await staking.stake(amount, EMPTY_STRING)
  }

  const timeSpanToData = (unit, start, end) => {
    return "0x" +
      unit.toString().padStart(64, "0") +
      web3.fromDecimal(start).slice(2).padStart(64, "0") +
      web3.fromDecimal(end).slice(2).padStart(64, "0")
  }

  const timeToData = (start, end) => timeSpanToData(TIME_UNIT_SECONDS, start, end)

  const blocksToData = (start, end) => timeSpanToData(TIME_UNIT_BLOCKS, start, end)

  const approveStakeAndLock = async(data, lockAmount = DEFAULT_AMOUNT / 2, stakeAmount = DEFAULT_AMOUNT) => {
    await approveAndStake(stakeAmount)
    const r = await staking.lock(lockAmount, manager.address, data)
    return getEvent(r, 'Locked', 'lockId')
  }

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_AMOUNT
    token = await StandardTokenMock.new(owner, initialAmount)

    const factory = await StakingFactory.new()
    const receipt = await factory.getOrCreateInstance(token.address)
    const stakingAddress = getEvent(receipt, 'NewStaking', 'instance');
    staking = Staking.at(stakingAddress)

    manager = await TimeLockManagerMock.new()
  })

  it('locks using seconds', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const [ _amount, _unlockedAt, _manager, _data ] = await staking.getLock(owner, lockId)
    assert.equal(_amount, DEFAULT_AMOUNT / 2, "locked amount should match")
    assert.equal(_unlockedAt.toString(), (await manager.MAX_UINT64()).toString(), "unlock time should match")
    assert.equal(_manager, manager.address, "unlocker should match")
    assert.equal(_data, data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, lockId), false, "Shouldn't be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_AMOUNT / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), parseInt(lockId, 10), "last lock id should match")

    await manager.setTimestamp(endTime + 1)
    // can unlock
    assert.equal(await staking.canUnlock(owner, lockId), true, "Should be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_AMOUNT / 2, "Unlocked balance should match")
  })

  it('locks using blocks', async () => {
    const startBlock = (await manager.getBlockNumberExt())
    const endBlock = parseInt(startBlock, 10) + DEFAULT_BLOCKS
    const data = blocksToData(startBlock, endBlock)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const [ _amount, _unlockedAt, _manager, _data ] = await staking.getLock(owner, lockId)
    assert.equal(_amount, DEFAULT_AMOUNT / 2, "locked amount should match")
    assert.equal(_unlockedAt.toString(), (await manager.MAX_UINT64()).toString(), "unlock time should match")
    assert.equal(_manager, manager.address, "unlocker should match")
    assert.equal(_data, data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, lockId), false, "Shouldn't be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_AMOUNT / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), parseInt(lockId, 10), "last lock id should match")

    await manager.setBlockNumber(endBlock + 1)
    // can unlock
    assert.equal(await staking.canUnlock(owner, lockId), true, "Should be able to unlock")
  })

  it('fails to unlock if can not unlock', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId)
    })
  })

  it('changes lock data', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const [ amount1, unlockedAt1, manager1, lockData1 ] = await staking.getLock(owner, lockId)
    assert.equal(lockData1, data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, lockId), false, "Shouldn't be able to unlock")

    // change data
    const startTime2 = fromBn(await manager.getTimestampExt()) - 2
    const endTime2 = startTime2 + 1
    const data2 = timeToData(startTime2, endTime2)
    await manager.setLockData(staking.address, owner, lockId, data2)


    // check lock values
    const [ amount2, unlockedAt2, manager2, lockData2 ] = await staking.getLock(owner, lockId)
    assert.equal(lockData2, data2, "lock data should match")

    // can unlock
    assert.equal(await staking.canUnlock(owner, lockId), true, "Should be able to unlock")
  })
})
