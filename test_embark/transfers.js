const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
const LockManagerMock = embark.require('Embark/contracts/LockManagerMock');

let accounts

config({}, (err, accts) => accounts = accts)

contract('Staking app, Transfering', () => {
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

  context('Transfers', async () => {
    context('From stake', async () => {
      it('transfers', async () => {
        //const initialTotalStake = await staking.totalStaked().call()
        await approveAndStake()
        await staking.transfer(user1, 0, DEFAULT_STAKE_AMOUNT / 2).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), DEFAULT_STAKE_AMOUNT / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), DEFAULT_STAKE_AMOUNT / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
      })

      it('transfers to lock', async () => {
        await approveAndStake()
        await token.mint(user1, DEFAULT_STAKE_AMOUNT).send()
        const lockId = await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        await staking.transfer(user1, lockId, DEFAULT_LOCK_AMOUNT).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // lock has increased amount now
        const { _amount } = await staking.getLock(user1, lockId).call()
        assert.equal(_amount.toString(), DEFAULT_LOCK_AMOUNT * 2, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), DEFAULT_STAKE_AMOUNT * 2, "Total stake should match")
      })

      it('fails transfering zero tokens', async () => {
        await approveAndStake()
        return assertRevert(async () => {
          await staking.transfer(user1, 0, 0).send()
        })
      })

      it('fails transfering more than unlocked balance', async () => {
        await approveAndStake(DEFAULT_STAKE_AMOUNT)
        return assertRevert(async () => {
          await staking.transfer(user1, 0, DEFAULT_STAKE_AMOUNT + 1).send()
        })
      })
    })

    context('From Lock', async () => {
      it('transfers', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        const transferAmount = DEFAULT_LOCK_AMOUNT / 2
        await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, 0, transferAmount).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), transferAmount, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const { _amount, _unlockedAt } = await staking.getLock(owner, lockId).call()
        assert.equal(_amount, DEFAULT_LOCK_AMOUNT - transferAmount, "locked amount should match")
        assert.equal(_unlockedAt.toString(), MAX_UINT64.toString(), "unlock time should match")
      })

      it('transfers the whole lock amount', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const { _amount, _unlockedAt } = await staking.getLock(owner, lockId).call()
        assert.equal(_amount, 0, "locked amount should match")
        assert.notEqual(_unlockedAt.toString(), MAX_UINT64.toString(), "unlock time should  be a 'real' number")
      })

      it('transfers to lock', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT).send()
        const toLockId = await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, toLockId, DEFAULT_LOCK_AMOUNT).send()

        assert.equal((await staking.unlockedBalanceOf(owner).call()).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1).call()).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // lock has increased amount now
        const { _amount } = await staking.getLock(user1, lockId).call()
        assert.equal(_amount.toString(), DEFAULT_LOCK_AMOUNT * 2, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked().call()).toString(), DEFAULT_STAKE_AMOUNT * 2, "Total stake should match")
      })

      it('fails if lockId is zero', async () => {
        await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          // it will fail at isLockManager modifier
          await lockManager.transferFromLock(stakingAddress, owner, 0, user1, 0, DEFAULT_LOCK_AMOUNT).send()
        })
      })

      it('fails transfering zero tokens', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, 0, 0).send()
        })
      })

      it('fails transfering more than locked balance', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT + 1).send()
        })
      })

      it('fails if sender is not manager', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        return assertRevert(async () => {
          await staking.transferFromLock(owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT).send({ from: user1 })
        })
      })

      it('fails transfering from unlocked lock', async () => {
        const lockId = await approveStakeAndLock(user1)
        // unlock
        await staking.unlock(owner, lockId).send({ from: user1 })
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT).send()
        })
      })

      it('fails transfering to unlocked lock', async () => {
        const lockId = await approveStakeAndLock(lockManagerAddress)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT).send()
        const toLockId = await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        // unlock
        await staking.unlock(user1, toLockId).send({ from: user2 })
        return assertRevert(async () => {
          await lockManager.transferFromLock(stakingAddress, owner, lockId, user1, toLockId, DEFAULT_LOCK_AMOUNT).send()
        })
      })
    })
  })
})
