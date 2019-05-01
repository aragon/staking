const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event === event)[0].args[arg] }

const Staking = artifacts.require('Staking');
const StakingFactory = artifacts.require('StakingFactory');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const LockManagerMock = artifacts.require('LockManagerMock');

contract('Staking app, Locking', ([owner, user1, user2]) => {
  let staking, token, lockManager

  const zeroBytes = "0x"
  const MAX_UINT64 = (new web3.BigNumber(2)).pow(new web3.BigNumber(64)).sub(new web3.BigNumber(1))
  const DEFAULT_STAKE_AMOUNT = 120
  const DEFAULT_LOCK_AMOUNT = DEFAULT_STAKE_AMOUNT / 3
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
    const r = await staking.lock(lockAmount, manager, EMPTY_STRING, { from })
    return getEvent(r, 'Locked', 'lockId')
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
    const lockId = await approveStakeAndLock(user1)

    // check lock values
    const [ _amount, _unlockedAt, _manager, _data ] = await staking.getLock(owner, lockId)
    assert.equal(_amount, DEFAULT_LOCK_AMOUNT, "locked amount should match")
    assert.equal(_unlockedAt.toString(), MAX_UINT64.toString(), "unlock time should match")
    assert.equal(_manager, user1, "unlocker should match")
    assert.equal(_data, zeroBytes, "lock data should match")

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), parseInt(lockId, 10), "last lock id should match")
  })

  it('fails locking 0 tokens', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.lock(0, user1, EMPTY_STRING)
    })
  })

  it('fails locking more tokens than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.lock(DEFAULT_STAKE_AMOUNT + 1, user1, EMPTY_STRING)
    })
  })

  it('unlocks last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // unlock
    await staking.unlock(owner, lockId, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks non-last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again
    await staking.lock(DEFAULT_LOCK_AMOUNT, user1, EMPTY_STRING)

    // unlock
    await staking.unlock(owner, lockId, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 1, "there should be just 1 lock")
  })

  it('unlocks, contract manager, called by owner', async () => {
    await lockManager.setResult(true)
    const lockId = await approveStakeAndLock(lockManager.address)

    // unlock
    await staking.unlock(owner, lockId, { from: owner })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager', async () => {
    await lockManager.setResult(true)
    const lockId = await approveStakeAndLock(lockManager.address)

    // unlock
    await lockManager.unlock(staking.address, owner, lockId)

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager, even if condition is not satisfied', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false)
    const lockId = await approveStakeAndLock(lockManager.address)

    // unlock
    await lockManager.unlock(staking.address, owner, lockId)

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 0, "there shouldn't be locks")
  })

  it('fails calling canUnlock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // call canUnlock
    return assertRevert(async () => {
      await staking.canUnlock(owner, lockId)
    })
  })

  it('fails to unlock if it cannot unlock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId)
    })
  })

  it('fails to unlock if can not unlock, contract manager, called by owner', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false)
    const lockId = await approveStakeAndLock(lockManager.address)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId, { from: owner })
    })
  })

  it('fails to unlock if, contract manager, called by 3rd party (even if condition is true)', async () => {
    await lockManager.setResult(true)
    const lockId = await approveStakeAndLock(lockManager.address)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId, { from: user1 })
    })
  })

  it('unlocks all', async () => {
    const lockId = await approveStakeAndLock(user1, DEFAULT_LOCK_AMOUNT / 2)
    // lock again
    await staking.lock(DEFAULT_LOCK_AMOUNT / 2, user1, EMPTY_STRING)

    // unlock
    await staking.unlockAll(owner, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks all with no previous locks', async () => {
    await staking.unlockAll(owner, { from: user1 })
    assert.equal((await staking.locksCount(owner)).valueOf(), 0, "there shouldn't be locks")
  })

  it('tries to unlockAll but it only unlocks one', async () => {
    const lockId = await approveStakeAndLock(user2)
    // lock again, different EOA manager
    await staking.lock(DEFAULT_LOCK_AMOUNT / 2, user1, EMPTY_STRING)

    // unlock
    await staking.unlockAll(owner, { from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner)).valueOf(), 1, "there shouldn't be locks")
  })

  it('fails trying to unlockAllOrNone if a lock cannot be unlocked', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again, different EOA manager
    await staking.lock(DEFAULT_LOCK_AMOUNT / 2, user2, EMPTY_STRING)

    // unlock
    return assertRevert(async () => {
      await staking.unlockAllOrNone(owner, { from: user1 })
    })
  })

  it('change lock amount', async () => {
    const lockId = await approveStakeAndLock(lockManager.address)
    const [ amount1 ] = await staking.getLock(owner, lockId)
    assert.equal(amount1, DEFAULT_LOCK_AMOUNT, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")

    // change amount
    const newLockAmount = DEFAULT_LOCK_AMOUNT / 2
    await lockManager.decreaseLockAmount(staking.address, owner, lockId, newLockAmount)

    const [ amount2 ] = await staking.getLock(owner, lockId)
    assert.equal(amount2, newLockAmount, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner)).valueOf(), DEFAULT_STAKE_AMOUNT - newLockAmount, "Unlocked balance should match")
  })

  it('fails to change lock amount to zero', async () => {
    const lockId = await approveStakeAndLock(lockManager.address)

    // try to change amount
    return assertRevert(async () => {
      await lockManager.decreaseLockAmount(staking.address, owner, lockId, 0)
    })
  })

  it('fails to change lock amount to greater than before', async () => {
    const lockId = await approveStakeAndLock(lockManager.address)

    // try to change amount
    return assertRevert(async () => {
      await lockManager.decreaseLockAmount(staking.address, owner, lockId, DEFAULT_LOCK_AMOUNT + 1)
    })
  })

  it('change lock manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    const [ amount1, unlockedAt1, manager1, data1 ] = await staking.getLock(owner, lockId)
    assert.equal(manager1, user1, "Manager should match")
    assert.equal(await staking.canUnlock(owner, lockId, { from: user1 }), true, "User 1 can unlock")
    assert.equal(await staking.canUnlock(owner, lockId, { from: user2 }), false, "User 2 can not unlock")

    // change manager
    await staking.setLockManager(owner, lockId, user2, { from: user1 })

    const [ amount2, unlockedAt2, manager2, data2 ] = await staking.getLock(owner, lockId)
    assert.equal(manager2, user2, "Manager should match")
    assert.equal(await staking.canUnlock(owner, lockId, { from: user1 }), false, "User 1 can not unlock")
    assert.equal(await staking.canUnlock(owner, lockId, { from: user2 }), true, "User 2 can unlock")
  })
})
