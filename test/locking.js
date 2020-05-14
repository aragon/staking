const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event === event)[0].args[arg] }

const Staking = artifacts.require('Staking');
const StakingFactory = artifacts.require('StakingFactory');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const LockManagerMock = artifacts.require('LockManagerMock');

contract('Staking app, Locking', ([owner, user1, user2]) => {
  let staking, token, lockManager

  const MAX_UINT64 = (new web3.BigNumber(2)).pow(new web3.BigNumber(64)).sub(new web3.BigNumber(1))
  const DEFAULT_STAKE_AMOUNT = 120
  const DEFAULT_LOCK_AMOUNT = DEFAULT_STAKE_AMOUNT / 3
  const ACTIVATED_LOCK = "0x01"
  const EMPTY_STRING = ''

  const approveAndStake = async (amount = DEFAULT_STAKE_AMOUNT, from = owner) => {
    await token.approve(staking.address, amount, { from })
    await staking.stake(amount, EMPTY_STRING, { from })
  }

  const approveStakeAndLock = async (
    manager,
    lockAmount = DEFAULT_LOCK_AMOUNT,
    stakeAmount = DEFAULT_STAKE_AMOUNT,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    await staking.lock(lockAmount, manager, ACTIVATED_LOCK, { from })
  }

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_STAKE_AMOUNT
    token = await StandardTokenMock.new(owner, initialAmount)

    const factory = await StakingFactory.new()
    const receipt = await factory.getOrCreateInstance(token.address)
    const stakingAddress = getEvent(receipt, 'NewStaking', 'instance');
    staking = Staking.at(stakingAddress)

    lockManager = await LockManagerMock.new()
  })

  it('locks', async () => {
    await approveStakeAndLock(user1)

    // check lock values
    const [ _amount, _data ] = await staking.getLock(owner, user1)
    assert.equal(_amount, DEFAULT_LOCK_AMOUNT, "locked amount should match")
    assert.equal(_data, ACTIVATED_LOCK, "lock data should match")

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
  })

  it('fails locking 0 tokens', async () => {
    await approveAndStake()
    await assertRevert(staking.lock(0, user1, ACTIVATED_LOCK))
  })

  it('fails locking without data', async () => {
    await approveAndStake()
    await assertRevert(staking.lock(1, user1, EMPTY_STRING))
  })

  it('fails locking more tokens than staked', async () => {
    await approveAndStake()
    await assertRevert(staking.lock(DEFAULT_STAKE_AMOUNT + 1, user1, ACTIVATED_LOCK))
  })

  it('fails locking if already locked', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.lock(DEFAULT_STAKE_AMOUNT, user1, "0x02"))
  })

  it('increases amount of existing lock', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await staking.increaseLockAmount(user1, DEFAULT_STAKE_AMOUNT)
  })

  it('fails increasing lock with 0 tokens', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.increaseLockAmount(user1, 0))
  })

  it('fails increasing lock with more tokens than staked', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.increaseLockAmount(user1, 2 * DEFAULT_STAKE_AMOUNT + 1))
  })

  it('unlocks with only 1 lock, EOA manager', async () => {
    await approveStakeAndLock(user1, DEFAULT_LOCK_AMOUNT)

    // unlock
    await staking.unlock(owner, user1, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLocked(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('unlocks with more than 1 lock, EOA manager', async () => {
    await approveStakeAndLock(user1)
    // lock again
    await staking.lock(DEFAULT_LOCK_AMOUNT, user2, ACTIVATED_LOCK)

    const previousTotalLocked = await staking.getTotalLocked(owner)

    // unlock
    await staking.unlock(owner, user1, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLocked(owner)).toString(), (previousTotalLocked.sub(DEFAULT_LOCK_AMOUNT)).toString(), "total locked doesn’t match")
  })

  it('unlocks, contract manager, called by owner', async () => {
    await lockManager.setResult(true)
    await approveStakeAndLock(lockManager.address)

    // unlock
    await staking.unlock(owner, lockManager.address, { from: owner })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLocked(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('unlocks, contract manager, called by manager', async () => {
    await lockManager.setResult(true)
    await approveStakeAndLock(lockManager.address)

    // unlock
    await lockManager.unlock(staking.address, owner, lockManager.address)

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLocked(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('unlocks, contract manager, called by manager, even if condition is not satisfied', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false)
    await approveStakeAndLock(lockManager.address)

    // unlock
    await lockManager.unlock(staking.address, owner, lockManager.address)

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLocked(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('fails calling canUnlock, EOA manager', async () => {
    await approveStakeAndLock(user1)

    // call canUnlock
    await assertRevert(staking.canUnlock(owner, user1, 0))
  })

  it('fails to unlock if it cannot unlock, EOA manager', async () => {
    await approveStakeAndLock(user1)

    // tries to unlock
    await assertRevert(staking.unlock(owner, user1))
  })

  it('fails to unlock if can not unlock, contract manager, called by owner', async () => {
    // not needed, is false by default
    // await lockManager.setResult(false)
    await approveStakeAndLock(lockManager.address)

    // tries to unlock
    await assertRevert(staking.unlock(owner, lockManager.address, { from: owner }))
  })

  it('fails to unlock if, contract manager, called by 3rd party (even if condition is true)', async () => {
    await lockManager.setResult(true)
    await approveStakeAndLock(lockManager.address)

    // tries to unlock
    await assertRevert(staking.unlock(owner, lockManager.address, { from: user1 }))
  })

  it('change lock amount', async () => {
    await approveStakeAndLock(lockManager.address)
    const [ amount1 ] = await staking.getLock(owner, lockManager.address)
    assert.equal(amount1, DEFAULT_LOCK_AMOUNT, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")

    // change amount
    const newLockAmount = DEFAULT_LOCK_AMOUNT / 2
    await lockManager.decreaseLockAmount(staking.address, owner, newLockAmount)

    const [ amount2 ] = await staking.getLock(owner, lockManager.address)
    assert.equal(amount2, newLockAmount, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - newLockAmount, "Unlocked balance should match")
  })

  it('fails to change lock amount to zero', async () => {
    await approveStakeAndLock(lockManager.address)

    // try to change amount
    await assertRevert(lockManager.decreaseLockAmount(staking.address, owner, 0))
  })

  it('fails to change lock amount to greater than before', async () => {
    await approveStakeAndLock(lockManager.address)

    // try to change amount
    await assertRevert(lockManager.decreaseLockAmount(staking.address, owner, DEFAULT_LOCK_AMOUNT + 1))
  })

  it('change lock manager', async () => {
    await approveStakeAndLock(user1)
    const [ amount1, data1 ] = await staking.getLock(owner, user1)
    assert.equal(await staking.canUnlock(owner, user1, 0, { from: user1 }), true, "User 1 can unlock")
    assert.equal(await staking.canUnlock(owner, user1, 0, { from: user2 }), false, "User 2 can not unlock")
    await assertRevert(staking.canUnlock(owner, user2, 0, { from: user2 })) // it doesn’t exist

    // change manager
    await staking.setLockManager(owner, user2, { from: user1 })

    const [ amount2, data2 ] = await staking.getLock(owner, user2)
    await assertRevert(staking.canUnlock(owner, user1, 0, { from: user1 })) // it doesn’t exist
    assert.equal(await staking.canUnlock(owner, user2, 0, { from: user1 }), false, "User 1 can not unlock")
    assert.equal(await staking.canUnlock(owner, user2, 0, { from: user2 }), true, "User 2 can unlock")
  })
})
