const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
const LockManagerMock = embark.require('Embark/contracts/LockManagerMock');

let accounts

config({}, (err, accts) => accounts = accts)

contract('Staking app, Locking', () => {
  let staking, token, lockManager, stakingAddress, tokenAddress, lockManagerAddress
  let owner, user1, user2

  const zeroBytes = "0x00"
  const MAX_UINT64 = (new web3.utils.BN(2)).pow(new web3.utils.BN(64)).sub(new web3.utils.BN(1))
  const DEFAULT_STAKE_AMOUNT = 120
  const DEFAULT_LOCK_AMOUNT = DEFAULT_STAKE_AMOUNT / 3
  const EMPTY_STRING = web3.utils.asciiToHex('')

  const approveAndStake = async (amount = DEFAULT_STAKE_AMOUNT, from = owner) => {
    await token.approve(stakingAddress, amount).send({ from })
    await staking.stake(amount, EMPTY_STRING).send({ from })
  }

  const approveStakeAndLock = async (
    manager,
    lockAmount = DEFAULT_LOCK_AMOUNT,
    stakeAmount = DEFAULT_STAKE_AMOUNT,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    const r = await staking.lock(lockAmount, manager, EMPTY_STRING).send({ from })
    const lockId = getEvent(r, 'Locked', 'lockId')

    return lockId
  }

  before(async () => {
    owner = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
  })

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_STAKE_AMOUNT
    const tokenContract = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    token = tokenContract.methods
    tokenAddress = tokenContract.options.address
    const stakingContract = await Staking.deploy({arguments: [tokenAddress]}).send()
    staking = stakingContract.methods
    stakingAddress = stakingContract.options.address
    const lockManagerContract = await LockManagerMock.deploy().send()
    lockManager = lockManagerContract.methods
    lockManagerAddress = lockManagerContract.options.address
  })

  it('locks', async () => {
    const lockId = await approveStakeAndLock(user1)

    // check lock values
    const { _amount, _unlockedAt, _manager, _data } = await staking.getLock(owner, lockId).call()
    assert.equal(_amount, DEFAULT_LOCK_AMOUNT, "locked amount should match")
    assert.equal(_unlockedAt.toString(), MAX_UINT64.toString(), "unlock time should match")
    assert.equal(_manager, user1, "unlocker should match")
    assert.equal(_data, zeroBytes, "lock data should match")

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")
  })

  it('fails locking 0 tokens', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.lock(0, user1, EMPTY_STRING).send()
    })
  })

  it('fails locking more tokens than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.lock(DEFAULT_STAKE_AMOUNT + 1, user1, EMPTY_STRING).send()
    })
  })

  it('unlocks last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // unlock
    await staking.unlock(owner, lockId).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks non-last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again
    await staking.lock(DEFAULT_LOCK_AMOUNT, user1, EMPTY_STRING).send()

    // unlock
    await staking.unlock(owner, lockId).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 1, "there should be just 1 lock")
  })

  it('unlocks, contract manager, called by owner', async () => {
    await lockManager.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // unlock
    await staking.unlock(owner, lockId).send({ from: owner })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager', async () => {
    await lockManager.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // unlock
    await lockManager.unlock(stakingAddress, owner, lockId).send()

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager, even if condition is not satisfied', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // unlock
    await lockManager.unlock(stakingAddress, owner, lockId).send()

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('fails calling canUnlock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // call canUnlock
    return assertRevert(async () => {
      await staking.canUnlock(owner, lockId).send()
    })
  })

  it('fails to unlock if it cannot unlock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId).send()
    })
  })

  it('fails to unlock if can not unlock, contract manager, called by owner', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId).send({ from: owner })
    })
  })

  it('fails to unlock if, contract manager, called by 3rd party (even if condition is true)', async () => {
    await lockManager.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // tries to unlock
    return assertRevert(async () => {
      await staking.unlock(owner, lockId).send({ from: user1 })
    })
  })

  it('unlocks all', async () => {
    const lockId = await approveStakeAndLock(user1, DEFAULT_LOCK_AMOUNT / 2)
    // lock again
    await staking.lock(DEFAULT_LOCK_AMOUNT / 2, user1, EMPTY_STRING).send()

    // unlock
    await staking.unlockAll(owner).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks all with no previous locks', async () => {
    await staking.unlockAll(owner).send({ from: user1 })
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('tries to unlockAll but it only unlocks one', async () => {
    const lockId = await approveStakeAndLock(user2)
    // lock again, different EOA manager
    await staking.lock(DEFAULT_LOCK_AMOUNT / 2, user1, EMPTY_STRING).send()

    // unlock
    await staking.unlockAll(owner).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 1, "there shouldn't be locks")
  })

  it('fails trying to unlockAllOrNone if a lock cannot be unlocked', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again, different EOA manager
    await staking.lock(DEFAULT_LOCK_AMOUNT / 2, user2, EMPTY_STRING).send()

    // unlock
    return assertRevert(async () => {
      await staking.unlockAllOrNone(owner).send({ from: user1 })
    })
  })

  it('change lock amount', async () => {
    const lockId = await approveStakeAndLock(lockManagerAddress)
    const { _amount: amount1 } = await staking.getLock(owner, lockId).call()
    assert.equal(amount1, DEFAULT_LOCK_AMOUNT, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Unlocked balance should match")

    // change amount
    const newLockAmount = DEFAULT_LOCK_AMOUNT / 2
    await lockManager.setLockAmount(stakingAddress, owner, lockId, newLockAmount).send()

    const { _amount: amount2 } = await staking.getLock(owner, lockId).call()
    assert.equal(amount2, newLockAmount, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), DEFAULT_STAKE_AMOUNT - newLockAmount, "Unlocked balance should match")
  })

  it('fails to change lock amount to zero', async () => {
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // try to change amount
    return assertRevert(async () => {
      await lockManager.setLockAmount(stakingAddress, owner, lockId, 0).send()
    })
  })

  it('fails to change lock amount to greater than before', async () => {
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // try to change amount
    return assertRevert(async () => {
      await lockManager.setLockAmount(stakingAddress, owner, lockId, DEFAULT_LOCK_AMOUNT + 1).send()
    })
  })

  it('change lock manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    const { _manager: manager1 } = await staking.getLock(owner, lockId).call()
    assert.equal(manager1, user1, "Manager should match")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user1 }), true, "User 1 can unlock")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user2 }), false, "User 2 can not unlock")

    // change manager
    await staking.setLockManager(owner, lockId, user2).send({ from: user1 })

    const { _manager: manager2} = await staking.getLock(owner, lockId).call()
    assert.equal(manager2, user2, "Manager should match")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user1 }), false, "User 1 can not unlock")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user2 }), true, "User 2 can unlock")
  })
})
