const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
const TimeLockManagerMock = embark.require('Embark/contracts/TimeLockManagerMock');

let accounts

config({}, (err, accts) => {accounts = accts})

contract('Staking app, Time locking', () => {
  let token, staking, manager, stakingAddress, tokenAddress, managerAddress, owner

  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  const defaultAmount = 100
  const defaultTime = 1000
  const defaultBlocks = 10

  const approveAndStake = async(amount = defaultAmount) => {
    await token.approve(stakingAddress, amount).send()
    await staking.stake(amount, web3.utils.asciiToHex('')).send()
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
    const r = await staking.lock(lockAmount, managerAddress, data).send()
    const lockId = getEvent(r, 'Locked', 'lockId')

    return lockId
  }

  before(async () => {
    owner = accounts[0]
  })

  beforeEach(async () => {
    const initialAmount = 1000 * defaultAmount
    const tokenContract = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    token = tokenContract.methods
    tokenAddress = tokenContract.options.address
    const stakingContract = await Staking.deploy({arguments: [tokenAddress]}).send()
    staking = stakingContract.methods
    stakingAddress = stakingContract.options.address
    const managerContract = await TimeLockManagerMock.deploy().send()
    manager = managerContract.methods
    managerAddress = managerContract.options.address
  })

  it('locks using seconds', async () => {
    const startTime = await manager.getTimestampExt().call()
    const endTime = parseInt(startTime, 10) + defaultTime
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), (await manager.MAX_UINT64().call()).toString(), "unlock time should match")
    assert.equal(lock[2], managerAddress, "unlocker should match")
    assert.equal(lock[3], data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, lockId).call(), false, "Shouldn't be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")

    await manager.setTimestamp(endTime + 1).send()
    // can unlock
    assert.equal(await staking.canUnlock(owner, lockId).call(), true, "Should be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
  })

  it('locks using blocks', async () => {
    const startBlock = (await manager.getBlockNumberExt().call())
    const endBlock = parseInt(startBlock, 10) + defaultBlocks
    const data = blocksToData(startBlock, endBlock)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), (await manager.MAX_UINT64().call()).toString(), "unlock time should match")
    assert.equal(lock[2], managerAddress, "unlocker should match")
    assert.equal(lock[3], data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, lockId).call(), false, "Shouldn't be able to unlock")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")

    await manager.setBlockNumber(endBlock + 1).send()
    // can unlock
    assert.equal(await staking.canUnlock(owner, lockId).call(), true, "Should be able to unlock")
  })

  it('fails to unlock if can not unlock', async () => {
    const startTime = await manager.getTimestampExt().call()
    const endTime = parseInt(startTime, 10) + defaultTime
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId).send()
    })
  })

  it('changes lock data', async () => {
    const startTime = await manager.getTimestampExt().call()
    const endTime = parseInt(startTime, 10) + defaultTime
    const data = timeToData(startTime, endTime)
    const lockId = await approveStakeAndLock(data)

    // check lock values
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[3], data, "lock data should match")

    // can not unlock
    assert.equal(await staking.canUnlock(owner, lockId).call(), false, "Shouldn't be able to unlock")

    // change data
    const startTime2 = parseInt(await manager.getTimestampExt().call(), 10) - 2
    const endTime2 = startTime2 + 1
    const data2 = timeToData(startTime2, endTime2)
    await manager.setLockData(stakingAddress, owner, lockId, data2).send()


    // check lock values
    const lock2 = await staking.getLock(owner, lockId).call()
    assert.equal(lock2[3], data2, "lock data should match")

    // can unlock
    assert.equal(await staking.canUnlock(owner, lockId).call(), true, "Should be able to unlock")
  })
})
