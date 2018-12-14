const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
const LockManagerMock = embark.require('Embark/contracts/LockManagerMock');

let accounts

config({}, (err, accts) => {accounts = accts})

contract('Staking app, Locking', () => {
  let staking, token, lockManager, stakingAddress, tokenAddress, lockManagerAddress
  let owner, user1, user2

  const zeroBytes = "0x00"
  const MAX_UINT64 = (new web3.utils.BN(2)).pow(new web3.utils.BN(64)).sub(new web3.utils.BN(1))
  const defaultAmount = 120

  const approveAndStake = async(amount = defaultAmount, from = owner) => {
    await token.approve(stakingAddress, amount).send({ from: from })
    await staking.stake(amount, web3.utils.asciiToHex('')).send({ from: from })
  }

  const approveStakeAndLock = async(
    manager,
    lockAmount = defaultAmount / 2,
    stakeAmount = defaultAmount,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    const r = await staking.lock(lockAmount, manager, web3.utils.asciiToHex('')).send({ from: from })
    const lockId = getEvent(r, 'Locked', 'lockId')

    return lockId
  }

  before(async () => {
    owner = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
  })

  beforeEach(async () => {
    const initialAmount = 1000 * defaultAmount
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
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), MAX_UINT64.toString(), "unlock time should match")
    assert.equal(lock[2], user1, "unlocker should match")
    assert.equal(lock[3], zeroBytes, "lock data should match")

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")
  })

  it('fails locking 0 tokens', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.lock(0, user1, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails locking more tokens than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.lock(defaultAmount + 1, user1, web3.utils.asciiToHex('')).send()
    })
  })

  it('unlocks last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // unlock
    await staking.unlock(owner, lockId).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks non-last lock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again
    await staking.lock(defaultAmount / 2, user1, web3.utils.asciiToHex('')).send()

    // unlock
    await staking.unlock(owner, lockId).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 1, "there should be just 1 lock")
  })

  it('unlocks, contract manager, called by owner', async () => {
    await lockManager.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // unlock
    await staking.unlock(owner, lockId).send({ from: owner })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager', async () => {
    await lockManager.setResult(true).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // unlock
    await lockManager.unlock(stakingAddress, owner, lockId).send()

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks, contract manager, called by manager, even if condition is not satisfied', async () => {
    // not needed, is false by default
    //await lockManager.setResult(false).send()
    const lockId = await approveStakeAndLock(lockManagerAddress)

    // unlock
    await lockManager.unlock(stakingAddress, owner, lockId).send()

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('fails calling canUnlock, EOA manager', async () => {
    const lockId = await approveStakeAndLock(user1)

    // call canUnlock
    return assertRevert(async () => {
      await staking.canUnlock(owner, lockId).send()
    })
  })

  it('fails to unlock if can not unlock, EOA manager', async () => {
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
    const lockId = await approveStakeAndLock(user1, defaultAmount / 4)
    // lock again
    await staking.lock(defaultAmount / 4, user1, web3.utils.asciiToHex('')).send()

    // unlock
    await staking.unlockAll(owner).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('unlocks all with no previous locks', async () => {
    await staking.unlockAll(owner).send({ from: user1 })
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 0, "there shouldn't be locks")
  })

  it('tries to unlockAll but it only unlocks one', async () => {
    const lockId = await approveStakeAndLock(user2)
    // lock again, different EOA manager
    await staking.lock(defaultAmount / 4, user1, web3.utils.asciiToHex('')).send()

    // unlock
    await staking.unlockAll(owner).send({ from: user1 })

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), 1, "there shouldn't be locks")
  })

  it('fails trying to unlockAllOrNone if a lock cannot be unlocked', async () => {
    const lockId = await approveStakeAndLock(user1)
    // lock again, different EOA manager
    await staking.lock(defaultAmount / 4, user2, web3.utils.asciiToHex('')).send()

    // unlock
    return assertRevert(async () => {
      await staking.unlockAllOrNone(owner).send({ from: user1 })
    })
  })

  it('change lock amount', async () => {
    const lockId = await approveStakeAndLock(lockManagerAddress)
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")

    // change amount
    await lockManager.setLockAmount(stakingAddress, owner, lockId, defaultAmount / 4).send()

    const lockAfter = await staking.getLock(owner, lockId).call()
    assert.equal(lockAfter[0], defaultAmount / 4, "Amount should match")
    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), 3 * defaultAmount / 4, "Unlocked balance should match")
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
      await lockManager.setLockAmount(stakingAddress, owner, lockId, defaultAmount / 2 + 1).send()
    })
  })

  it('change lock manager', async () => {
    const lockId = await approveStakeAndLock(user1)
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[2], user1, "Manager should match")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user1 }), true, "User 1 can unlock")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user2 }), false, "User 2 can not unlock")

    // change manager
    await staking.setLockManager(owner, lockId, user2).send({ from: user1 })

    const lockAfter = await staking.getLock(owner, lockId).call()
    assert.equal(lockAfter[2], user2, "Manager should match")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user1 }), false, "User 1 can not unlock")
    assert.equal(await staking.canUnlock(owner, lockId).call({ from: user2 }), true, "User 2 can unlock")
  })

  context('Transfers', async () => {
    context('From stake', async () => {
      it('transfers', async () => {
        //const initialTotalStake = await staking.totalStaked().call()
        await approveAndStake()
        await staking.transfer(defaultAmount / 2, user1, 0).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
      })

      it('transfers to lock', async () => {
        await approveAndStake()
        await token.mint(user1, defaultAmount).send()
        const lockId = await approveStakeAndLock(user2, defaultAmount / 2, defaultAmount, user1)
        await staking.transfer(defaultAmount / 2, user1, lockId).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // lock has increased amount now
        const lock = await staking.getLock(user1, lockId).call()
        assert.equal(lock[0].toString(), defaultAmount, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), defaultAmount * 2, "Total stake should match")
      })

      it('fails transfering zero tokens', async () => {
        await approveAndStake()
        return assertRevert(async () => {
          await staking.transfer(0, user1, 0).send()
        })
      })

      it('fails transfering more than unlocked balance', async () => {
        await approveAndStake(defaultAmount)
        return assertRevert(async () => {
          await staking.transfer(defaultAmount + 1, user1, 0).send()
        })
      })
    })

    context('From Lock', async () => {
      it('transfers', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await lockManager.transferFromLock(stakingAddress, owner, lockId, defaultAmount / 4, user1, 0).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 4, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
        // check lock values
        const lock = await staking.getLock(owner, lockId).call()
        assert.equal(lock[0], defaultAmount / 4, "locked amount should match")
        assert.equal(lock[1].toString(), MAX_UINT64.toString(), "unlock time should match")
      })

      it('transfers the whole lock amount', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await lockManager.transferFromLock(stakingAddress, owner, lockId, defaultAmount / 2, user1, 0).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
        // check lock values
        const lock = await staking.getLock(owner, lockId).call()
        assert.equal(lock[0], 0, "locked amount should match")
        assert.notEqual(lock[1].toString(), MAX_UINT64.toString(), "unlock time should  be a 'real' number")
      })

      it('transfers to lock', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await token.mint(user1, defaultAmount).send()
        const toLockId = await approveStakeAndLock(user2, defaultAmount / 2, defaultAmount, user1)
        await lockManager.transferFromLock(stakingAddress, owner, lockId, defaultAmount / 2, user1, toLockId).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), defaultAmount / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), defaultAmount / 2, "User 1 balance should match")
        // lock has increased amount now
        const lock = await staking.getLock(user1, lockId).call()
        assert.equal(lock[0].toString(), defaultAmount, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), defaultAmount * 2, "Total stake should match")
      })

      it('fails if lockId is zero', async () => {
        await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          // it will fail at isLockManager modifier
          await lockManager.transferFromLock(stakingAddress, owner, 0, defaultAmount / 2, user1, 0).send()
        })
      })

      it('fails transfering zero tokens', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, 0, user1, 0).send()
        })
      })

      it('fails transfering more than locked balance', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, defaultAmount / 2 + 1, user1, 0).send()
        })
      })

      it('fails if sender is not manager', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          await staking.transferFromLock(owner, lockId, defaultAmount / 2, user1, 0).send({ from: user1 })
        })
      })

      it('fails transfering from unlocked lock', async () => {
        const lockId = await approveStakeAndLock(user1)
        // unlock
        await staking.unlock(owner, lockId).send({ from: user1 })
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, defaultAmount / 2, user1, 0).send()
        })
      })

      it('fails transfering to unlocked lock', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await token.mint(user1, defaultAmount).send()
        const toLockId = await approveStakeAndLock(user2, defaultAmount / 2, defaultAmount, user1)
        // unlock
        await staking.unlock(user1, toLockId).send({ from: user2 })
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, defaultAmount / 2, user1, toLockId).send()
        })
      })
    })
  })
})
