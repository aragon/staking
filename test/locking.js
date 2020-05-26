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
  const EMPTY_DATA = '0x'

  const approveAndStake = async (amount = DEFAULT_STAKE_AMOUNT, from = owner) => {
    await token.approve(staking.address, amount, { from })
    await staking.stake(amount, EMPTY_DATA, { from })
  }

  const approveStakeAndLock = async (
    manager,
    lockAmount = DEFAULT_LOCK_AMOUNT,
    stakeAmount = DEFAULT_STAKE_AMOUNT,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    await staking.allowManagerAndLock(lockAmount, manager, lockAmount, EMPTY_DATA, { from })
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

  it('allows new manager and locks amount', async () => {
    await approveStakeAndLock(user1)

    // check lock values
    const [ _amount, _allowance ] = await staking.getLock(owner, user1)
    assert.equal(_amount, DEFAULT_LOCK_AMOUNT, "locked amount should match")
    assert.equal(_allowance, DEFAULT_LOCK_AMOUNT, "locked allowance should match")

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    const [ staked, locked ] = await staking.getBalancesOf(owner)
    assert.equal(staked.toString(), DEFAULT_STAKE_AMOUNT, "Staked balance should match")
    assert.equal(locked.toString(), DEFAULT_LOCK_AMOUNT, "Locked balance should match")
  })

  it('fails locking 0 tokens', async () => {
    await approveAndStake()
    await assertRevert(staking.allowManagerAndLock(0, user1, 1, EMPTY_DATA))
  })

  it('fails locking without enough allowance', async () => {
    await approveAndStake()
    await assertRevert(staking.allowManagerAndLock(2, user1, 1, EMPTY_DATA))
  })

  it('fails locking more tokens than staked', async () => {
    await approveAndStake()
    await assertRevert(staking.allowManagerAndLock(DEFAULT_STAKE_AMOUNT + 1, user1, DEFAULT_STAKE_AMOUNT + 1, EMPTY_DATA))
  })

  it('fails locking if already locked', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.allowManagerAndLock(DEFAULT_STAKE_AMOUNT, user1, DEFAULT_STAKE_AMOUNT, "0x02"))
  })

  it('creates a new allowance', async () => {
    await staking.allowNewLockManager(user1, DEFAULT_LOCK_AMOUNT, EMPTY_DATA)

    const [ , _allowance  ] = await staking.getLock(owner, user1)
    assert.equal(_allowance, DEFAULT_LOCK_AMOUNT, "allowed amount should match")
  })

  it('creates a new allowance and then lock manager locks', async () => {
    await approveAndStake()
    await staking.allowNewLockManager(user1, DEFAULT_LOCK_AMOUNT, EMPTY_DATA)
    await staking.increaseLockAmount(owner, user1, DEFAULT_LOCK_AMOUNT, { from: user1 })

    // check lock values
    const [ _amount, _allowance ] = await staking.getLock(owner, user1)
    assert.equal(_amount, DEFAULT_LOCK_AMOUNT, "locked amount should match")
    assert.equal(_allowance, DEFAULT_LOCK_AMOUNT, "locked allowance should match")

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
  })

  it('fails creating allowance of 0 tokens', async () => {
    await assertRevert(staking.allowNewLockManager(user1, 0, EMPTY_DATA))
  })

  it('fails creating allowance if lock exists', async () => {
    await approveStakeAndLock(user1)
    await assertRevert(staking.allowNewLockManager(user1, 1, EMPTY_DATA))
  })

  it('increases allowance of existing lock', async () => {
    await approveStakeAndLock(user1)

    await staking.increaseLockAllowance(user1, DEFAULT_LOCK_AMOUNT)

    const [ , _allowance  ] = await staking.getLock(owner, user1)
    assert.equal(_allowance, 2 * DEFAULT_LOCK_AMOUNT, "allowed amount should match")
  })

  it('fails increasing allowance of non-existing', async () => {
    await assertRevert(staking.increaseLockAllowance(user1, 1))
  })

  it('fails increasing allowance of existing lock by 0', async () => {
    await approveStakeAndLock(user1)

    await assertRevert(staking.increaseLockAllowance(user1, 0))
  })

  it('fails increasing allowance of existing lock if not owner or manager', async () => {
    await approveStakeAndLock(user1)

    await assertRevert(staking.increaseLockAllowance(user1, 1, { from: user2 }))
  })

  it('decreases allowance of existing lock by the owner', async () => {
    await approveAndStake()
    await staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, user1, DEFAULT_LOCK_AMOUNT + 1, EMPTY_DATA)

    await staking.decreaseLockAllowance(owner, user1, 1, { from: owner })

    const [ , _allowance  ] = await staking.getLock(owner, user1)
    assert.equal(_allowance, DEFAULT_LOCK_AMOUNT, "allowed amount should match")
  })

  it('decreases allowance of existing lock by manager', async () => {
    await approveAndStake()
    await staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, user1, DEFAULT_LOCK_AMOUNT + 1, EMPTY_DATA)

    await staking.decreaseLockAllowance(owner, user1, 1, { from: user1 })

    const [ , _allowance  ] = await staking.getLock(owner, user1)
    assert.equal(_allowance, DEFAULT_LOCK_AMOUNT, "allowed amount should match")
  })

  it('fails decreasing allowance of existing lock by 0', async () => {
    await approveStakeAndLock(user1)

    await assertRevert(staking.decreaseLockAllowance(owner, user1, 0))
  })

  it('fails decreasing allowance of existing lock to 0', async () => {
    await approveStakeAndLock(user1)

    await staking.decreaseLockAmount(owner, user1, DEFAULT_LOCK_AMOUNT, { from: user1 })

    await assertRevert(staking.decreaseLockAllowance(owner, user1, DEFAULT_LOCK_AMOUNT))
  })

  it('fails decreasing allowance to less than lock', async () => {
    await approveAndStake()
    await staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, user1, DEFAULT_LOCK_AMOUNT + 1, EMPTY_DATA)

    await assertRevert(staking.decreaseLockAllowance(owner, user1, 2))
  })

  it('fails decreasing allowance by 3rd party', async () => {
    await approveAndStake()
    await staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, user1, DEFAULT_LOCK_AMOUNT + 1, EMPTY_DATA)

    await assertRevert(staking.decreaseLockAllowance(owner, user1, 1, { from: user2 }))
  })

  it('increases amount of existing lock', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await staking.increaseLockAllowance(user1, DEFAULT_LOCK_AMOUNT)
    await staking.increaseLockAmount(owner, user1, DEFAULT_LOCK_AMOUNT)

    const [ _amount,  ] = await staking.getLock(owner, user1)
    assert.equal(_amount, 2 * DEFAULT_LOCK_AMOUNT, "locked amount should match")
  })

  it('fails increasing lock with 0 tokens', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.increaseLockAmount(owner, user1, 0))
  })

  it('fails increasing lock with more tokens than staked', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.increaseLockAmount(owner, user1, 2 * DEFAULT_STAKE_AMOUNT + 1))
  })

  it('fails increasing lock if not owner or manager', async () => {
    await approveStakeAndLock(user1)

    await approveAndStake()
    await assertRevert(staking.increaseLockAmount(owner, user1, 1, { from: user2 }))
  })

  it('unlocks with only 1 lock, EOA manager', async () => {
    await approveStakeAndLock(user1, DEFAULT_LOCK_AMOUNT)

    // unlock
    await staking.decreaseAndRemoveManager(owner, user1, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLockedOf(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('unlocks with more than 1 lock, EOA manager', async () => {
    await approveStakeAndLock(user1)
    // lock again
    await staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, user2, DEFAULT_LOCK_AMOUNT, EMPTY_DATA)

    const previousTotalLocked = await staking.getTotalLockedOf(owner)

    // unlock
    await staking.decreaseAndRemoveManager(owner, user1, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLockedOf(owner)).toString(), (previousTotalLocked.sub(DEFAULT_LOCK_AMOUNT)).toString(), "total locked doesn’t match")
  })

  it('unlocks, contract manager, called by owner', async () => {
    await lockManager.setResult(true)
    await approveStakeAndLock(lockManager.address)

    // unlock
    await staking.decreaseAndRemoveManager(owner, lockManager.address, { from: owner })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLockedOf(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('unlocks, contract manager, called by manager', async () => {
    await lockManager.setResult(true)
    await approveStakeAndLock(lockManager.address)

    // unlock
    await lockManager.unlock(staking.address, owner, lockManager.address)

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLockedOf(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('unlocks, contract manager, called by manager, even if condition is not satisfied', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false)
    await approveStakeAndLock(lockManager.address)

    // unlock
    await lockManager.unlock(staking.address, owner, lockManager.address)

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.getTotalLockedOf(owner)).toString(), '0', "total locked doesn’t match")
  })

  it('fails calling canUnlock, EOA manager', async () => {
    await approveStakeAndLock(user1)

    // call canUnlock
    await assertRevert(staking.canUnlock(owner, user1, 0))
  })

  it('fails to unlock if it cannot unlock, EOA manager', async () => {
    await approveStakeAndLock(user1)

    // tries to unlock
    await assertRevert(staking.decreaseAndRemoveManager(owner, user1))
  })

  it('fails to unlock if can not unlock, contract manager, called by owner', async () => {
    // not needed, is false by default
    // await lockManager.setResult(false)
    await approveStakeAndLock(lockManager.address)

    // tries to unlock
    await assertRevert(staking.decreaseAndRemoveManager(owner, lockManager.address, { from: owner }))
  })

  it('fails to unlock if, contract manager, called by 3rd party (even if condition is true)', async () => {
    await lockManager.setResult(true)
    await approveStakeAndLock(lockManager.address)

    // tries to unlock
    await assertRevert(staking.decreaseAndRemoveManager(owner, lockManager.address, { from: user1 }))
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
    assert.equal(await staking.canUnlock(owner, user1, 0, { from: user1 }), true, "User 1 can unlock")
    assert.equal(await staking.canUnlock(owner, user1, 0, { from: user2 }), false, "User 2 can not unlock")
    await assertRevert(staking.canUnlock(owner, user2, 0, { from: user2 })) // it doesn’t exist

    // change manager
    await staking.setLockManager(owner, user2, { from: user1 })

    await assertRevert(staking.canUnlock(owner, user1, 0, { from: user1 })) // it doesn’t exist
    assert.equal(await staking.canUnlock(owner, user2, 0, { from: user1 }), false, "User 1 can not unlock")
    assert.equal(await staking.canUnlock(owner, user2, 0, { from: user2 }), true, "User 2 can unlock")
  })
})
