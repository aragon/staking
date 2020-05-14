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
    await staking.lock(lockAmount, manager.address, data)
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
    await approveStakeAndLock(data)

    // check lock values
    const [ _amount, _data ] = await staking.getLock(owner, manager.address)
    assert.equal(_amount, DEFAULT_AMOUNT / 2, "locked amount should match")
    assert.equal(_data, data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, manager.address, 0), false, "Shouldn't be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_AMOUNT / 2, "Unlocked balance should match")

    await manager.setTimestamp(endTime + 1)
    // can unlock
    assert.equal(await staking.canUnlock(owner, manager.address, 0), true, "Should be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_AMOUNT / 2, "Unlocked balance should match")
  })

  it('locks using blocks', async () => {
    const startBlock = (await manager.getBlockNumberExt())
    const endBlock = parseInt(startBlock, 10) + DEFAULT_BLOCKS
    const data = blocksToData(startBlock, endBlock)
    await approveStakeAndLock(data)

    // check lock values
    const [ _amount, _data ] = await staking.getLock(owner, manager.address)
    assert.equal(_amount, DEFAULT_AMOUNT / 2, "locked amount should match")
    assert.equal(_data, data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, manager.address, 0), false, "Shouldn't be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_AMOUNT / 2, "Unlocked balance should match")

    await manager.setBlockNumber(endBlock + 1)
    // can unlock
    assert.equal(await staking.canUnlock(owner, manager.address, 0), true, "Should be able to unlock")
  })

  it('fails to unlock if can not unlock', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME
    const data = timeToData(startTime, endTime)
    await approveStakeAndLock(data)

    // tries to unlock
    await assertRevert(staking.unlock(owner, manager.address))
  })

  it('changes lock data', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME
    const data = timeToData(startTime, endTime)
    await approveStakeAndLock(data)

    // check lock values
    const [ amount1, lockData1 ] = await staking.getLock(owner, manager.address)
    assert.equal(lockData1, data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, manager.address, 0), false, "Shouldn't be able to unlock")

    // change data
    const startTime2 = fromBn(await manager.getTimestampExt()) - 2
    const endTime2 = startTime2 + 1
    const data2 = timeToData(startTime2, endTime2)
    await manager.setLockData(staking.address, owner, data2)


    // check lock values
    const [ amount2, lockData2 ] = await staking.getLock(owner, manager.address)
    assert.equal(lockData2, data2, "lock data should match")

    // can unlock
    assert.equal(await staking.canUnlock(owner, manager.address, 0), true, "Should be able to unlock")
  })
})
