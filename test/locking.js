const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
const LockManagerMock = embark.require('Embark/contracts/LockManagerMock');

let accounts

config({}, (err, accts) => {
  accounts = accts
})

contract('Staking app - Locking', () => {
  let staking, token, owner, user1, user2

  const zeroBytes = "0x00"
  const MAX_UINT64 = (new web3.utils.BN(2)).pow(new web3.utils.BN(64)).sub(new web3.utils.BN(1))
  const defaultAmount = 100

  const approveAndStake = async(_amount = defaultAmount, _from = owner) => {
    await token.methods.approve(staking.options.address, _amount).send({ from: _from })
    await staking.methods.stake(_amount, web3.utils.asciiToHex('')).send({ from: _from })
  }

  const approveStakeAndLock = async(
    manager,
    lockAmount = defaultAmount / 2,
    stakeAmount = defaultAmount,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    const r = await staking.methods.lock(lockAmount, manager, web3.utils.asciiToHex('')).send({ from: from })
    const lockId = getEvent(r, 'Locked', 'lockId')

    return lockId
  }

  before(async () => {
    owner = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
  })

  beforeEach(async () => {
    const initialAmount = web3.utils.toWei('1000', 'ether')
    token = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    staking = await Staking.deploy({arguments: [token.options.address]}).send()
  })

  /*
  it('locks', async () => {
    const lockId = await approveStakeAndLock(user1)

    // check lock values
    const lock = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), MAX_UINT64.toString(), "unlock time should match")
    assert.equal(lock[2], user1, "unlocker should match")
    assert.equal(lock[3], zeroBytes, "lock data should match")

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")
  })

  it('fails locking 0 tokens', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.methods.lock(0, user1, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails locking more tokens than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.methods.lock(defaultAmount + 1, user1, web3.utils.asciiToHex('')).send()
    })
  })

  it('unlocks last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // unlock
    await staking.methods.unlock(owner, lockId).send({ from: user1 })

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks non-last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again
    await staking.methods.lock(defaultAmount / 2, user1, web3.utils.asciiToHex('')).send()

    // unlock
    await staking.methods.unlock(owner, lockId).send({ from: user1 })

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 1, "there should be just 1 lock")
  })

  it('unlocks, contract manager, called by owner', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    await lockManager.methods.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManager.options.address)

    // unlock
    await staking.methods.unlock(owner, lockId).send({ from: owner })

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    await lockManager.methods.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManager.options.address)

    // unlock
    await lockManager.methods.unlock(staking.options.address, owner, lockId).send()

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager, even if condition is not satisfied', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    // not needed, is false by default
    //await lockManager.methods.setResult(false).send()
    const lockId = await approveStakeAndLock(lockManager.options.address)

    // unlock
    await lockManager.methods.unlock(staking.options.address, owner, lockId).send()

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('fails to unlock if can not unlock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // tries to unlock
    return assertRevert(async () => {
      await staking.methods.unlock(owner, lockId).send()
    })
  })

  it('fails to unlock if can not unlock, contract manager, called by owner', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    // not needed, is false by default
    //await lockManager.methods.setResult(false).send()
    const lockId = await approveStakeAndLock(lockManager.options.address)

    // tries to unlock
    return assertRevert(async () => {
      await staking.methods.unlock(owner, lockId).send({ from: owner })
    })
  })

  it('fails to unlock if, contract manager, called by 3rd party (even if condition is true)', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    await lockManager.methods.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManager.options.address)

    // tries to unlock
    return assertRevert(async () => {
      await staking.methods.unlock(owner, lockId).send({ from: user1 })
    })
  })

  it('unlocks all', async () => {
    const lockId = await approveStakeAndLock(user1, defaultAmount / 4)
    // lock again
    await staking.methods.lock(defaultAmount / 4, user1, web3.utils.asciiToHex('')).send()

    // unlock
    await staking.methods.unlockAll(owner).send({ from: user1 })

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks all with no previous locks', async () => {
    await staking.methods.unlockAll(owner).send({ from: user1 })
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('tries to unlockAll but it only unlocks one', async () => {
    const lockId = await approveStakeAndLock(user2)
    // lock again, different EOA manager
    await staking.methods.lock(defaultAmount / 4, user1, web3.utils.asciiToHex('')).send()

    // unlock
    await staking.methods.unlockAll(owner).send({ from: user1 })

    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.methods.locksCount(owner).call()).valueOf(), 1, "there shouldn't be locks")
  })

  it('fails trying to unlockAllOrNone if a lock cannot be unlocked', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again, different EOA manager
    await staking.methods.lock(defaultAmount / 4, user2, web3.utils.asciiToHex('')).send()

    // unlock
    return assertRevert(async () => {
      await staking.methods.unlockAllOrNone(owner).send({ from: user1 })
    })
  })

  it('change lock amount', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    const lockId = await approveStakeAndLock(lockManager.options.address)
    const lock = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "Amount should match")
    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")

    // change amount
    await lockManager.methods.setLockAmount(staking.options.address, owner, lockId, defaultAmount / 4).send()

    const lockAfter = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lockAfter[0], defaultAmount / 4, "Amount should match")
    assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).valueOf(), 3 * defaultAmount / 4, "Unlocked balance should match")
  })

  it('fails to change lock amount to zero', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    const lockId = await approveStakeAndLock(lockManager.options.address)
    const lock = await staking.methods.getLock(owner, lockId).call()

    // try to change amount
    return assertRevert(async () => {
      await lockManager.methods.setLockAmount(staking.options.address, owner, lockId, defaultAmount).send()
    })
  })

  it('fails to change lock amount to greater than before', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    const lockId = await approveStakeAndLock(lockManager.options.address)
    const lock = await staking.methods.getLock(owner, lockId).call()

    // try to change amount
    return assertRevert(async () => {
      await lockManager.methods.setLockAmount(staking.options.address, owner, lockId, defaultAmount / 2 + 1).send()
    })
  })

  it('change lock manager', async () => {
    const lockManager = await LockManagerMock.deploy().send()
    const lockId = await approveStakeAndLock(user1)
    const lock = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lock[2], user1, "Manager should match")
    assert.equal(await staking.methods.canUnlock(owner, lockId).call({ from: user1 }), true, "User 1 can unlock")
    assert.equal(await staking.methods.canUnlock(owner, lockId).call({ from: user2 }), false, "User 2 can not unlock")

    // change manager
    await staking.methods.setLockManager(owner, lockId, user2).send({ from: user1 })

    const lockAfter = await staking.methods.getLock(owner, lockId).call()
    assert.equal(lockAfter[2], user2, "Manager should match")
    assert.equal(await staking.methods.canUnlock(owner, lockId).call({ from: user1 }), false, "User 1 can not unlock")
    assert.equal(await staking.methods.canUnlock(owner, lockId).call({ from: user2 }), true, "User 2 can unlock")
  })
  */

  context('Transfers', async () => {
    context('From stake', async () => {
      it('transfers', async () => {
        //const initialTotalStake = await staking.methods.totalStaked().call()
        await approveAndStake()
        await staking.methods.transfer(defaultAmount / 2, user1, 0).send()

        assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.methods.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.methods.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
      })

      it('transfers to lock', async () => {
        await approveAndStake()
        await token.methods.mint(user1, defaultAmount).send()
        const lockId = await approveStakeAndLock(user2, defaultAmount / 2, defaultAmount, user1)
        await staking.methods.transfer(defaultAmount / 2, user1, lockId).send()

        assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.methods.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // lock has increased amount now
        const lock = await staking.methods.getLock(user1, lockId).call()
        assert.equal(lock[0].toString(), defaultAmount, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.methods.totalStaked().call()).toString(), defaultAmount * 2, "Total stake should match")
      })

      it('fails transfering zero tokens', async () => {
        await approveAndStake()
        return assertRevert(async () => {
          await staking.methods.transfer(0, user1, 0).send()
        })
      })

      it('fails transfering more than unlocked balance', async () => {
        await approveAndStake(defaultAmount)
        return assertRevert(async () => {
          await staking.methods.transfer(defaultAmount + 1, user1, 0).send()
        })
      })
    })
    context('From Lock', async () => {
      let lockManager
      before(async () => {
        lockManager = await LockManagerMock.deploy().send()
      })

      it('transfers', async () => {
        const lockId = await approveStakeAndLock(lockManager.options.address)
        const TODO = await lockManager.methods.transferFromLock(staking.options.address, owner, lockId, defaultAmount / 2, user1, 0).send()

        assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.methods.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.methods.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
      })

      it('transfers to lock', async () => {
        const lockId = await approveStakeAndLock(lockManager.options.address)
        await token.methods.mint(user1, defaultAmount).send()
        const toLockId = await approveStakeAndLock(user2, defaultAmount / 2, defaultAmount, user1)
        await lockManager.methods.transferFromLock(staking.options.address, owner, lockId, defaultAmount / 2, user1, toLockId).send()

        assert.equal((await staking.methods.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.methods.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // lock has increased amount now
        const lock = await staking.methods.getLock(user1, lockId).call()
        assert.equal(lock[0].toString(), defaultAmount, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.methods.totalStaked().call()).toString(), defaultAmount * 2, "Total stake should match")
      })

      it('fails transfering zero tokens', async () => {
        const lockId = await approveStakeAndLock(lockManager.options.address)
        return assertRevert(async () => {
          await lockManager.methods.transferFromLock(staking.options.address, owner, lockId, 0, user1, 0).send()
        })
      })

      it('fails transfering more than locked balance', async () => {
        const lockId = await approveStakeAndLock(lockManager.options.address)
        return assertRevert(async () => {
          await lockManager.methods.transferFromLock(staking.options.address, owner, lockId, defaultAmount / 2 + 1, user1, 0).send()
        })
      })

      it('fails if sender is not manager', async () => {
        const lockId = await approveStakeAndLock(lockManager.options.address)
        return assertRevert(async () => {
          await staking.methods.transferFromLock(owner, lockId, defaultAmount / 2, user1, 0).send({ from: user1 })
        })
      })
    })
  })
})
