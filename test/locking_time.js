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

  const approveStakeAndLock = async(unit, start, end, lockAmount = DEFAULT_AMOUNT / 2, stakeAmount = DEFAULT_AMOUNT) => {
    await approveAndStake(stakeAmount)
    // allow manager
    await staking.allowNewLockManager(manager.address, lockAmount, EMPTY_STRING)
    // lock amount
    await manager.lock(staking.address, owner, lockAmount, unit, start, end)
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
    await approveStakeAndLock(TIME_UNIT_SECONDS, startTime, endTime)

    // check lock values
    const [ _amount, _allowance ] = await staking.getLock(owner, manager.address)
    assert.equal(_amount, DEFAULT_AMOUNT / 2, "locked amount should match")
    assert.equal(_allowance, DEFAULT_AMOUNT / 2, "locked allowance should match")

    // check time values
    const [ _unit, _start, _end ] = await manager.getTimeInterval(owner)
    assert.equal(_unit, TIME_UNIT_SECONDS, "interval unit should match")
    assert.equal(_start.toString(), startTime.toString(), "interval start should match")
    assert.equal(_end.toString(), endTime.toString(), "interval end should match")

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
    await approveStakeAndLock(TIME_UNIT_BLOCKS, startBlock, endBlock)

    // check lock values
    const [ _amount, _allowance ] = await staking.getLock(owner, manager.address)
    assert.equal(_amount, DEFAULT_AMOUNT / 2, "locked amount should match")
    assert.equal(_allowance, DEFAULT_AMOUNT / 2, "locked allowance should match")

    // check time values
    const [ _unit, _start, _end ] = await manager.getTimeInterval(owner)
    assert.equal(_unit, TIME_UNIT_BLOCKS, "interval unit should match")
    assert.equal(_start.toString(), startBlock.toString(), "interval start should match")
    assert.equal(_end.toString(), endBlock.toString(), "interval end should match")

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
    await approveStakeAndLock(TIME_UNIT_SECONDS, startTime, endTime)

    // tries to unlock
    await assertRevert(staking.unlockAndRemoveManager(owner, manager.address))
  })

  it('fails trying to lock twice', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME
    await approveStakeAndLock(TIME_UNIT_SECONDS, startTime, endTime)

    await assertRevert(manager.lock(staking.address, owner, DEFAULT_AMOUNT / 2, TIME_UNIT_SECONDS, startTime, endTime))
  })


  it('fails trying to lock with wrong interval', async () => {
    const startTime = await manager.getTimestampExt()
    const endTime = parseInt(startTime, 10) + DEFAULT_TIME

    await approveAndStake(DEFAULT_AMOUNT)
    // allow manager
    await staking.allowNewLockManager(manager.address, DEFAULT_AMOUNT, EMPTY_STRING)
    // times are reverted!
    await assertRevert(manager.lock(staking.address, owner, DEFAULT_AMOUNT / 2, TIME_UNIT_SECONDS, endTime, startTime))
  })
})
