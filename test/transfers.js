const { assertRevert } = require('@aragon/contract-helpers-test/assertThrow')
const { MAX_UINT64 } = require('@aragon/contract-helpers-test/numbers')

const { deploy } = require('./helpers/deploy')(artifacts)
const { DEFAULT_STAKE_AMOUNT, DEFAULT_LOCK_AMOUNT, EMPTY_DATA, ZERO_ADDRESS } = require('./helpers/constants')
const { STAKING_ERRORS } = require('./helpers/errors')

contract('Staking app, Transferring', ([owner, user1, user2]) => {
  let staking, token, lockManager

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
    const deployment = await deploy(owner)
    token = deployment.token
    staking = deployment.staking
    lockManager = deployment.lockManager
  })

  context('Transfers', async () => {
    context('From stake', async () => {
      it('transfers', async () => {
        //const initialTotalStake = await staking.totalStaked()
        await approveAndStake()
        await staking.transfer(user1, ZERO_ADDRESS, DEFAULT_STAKE_AMOUNT / 2)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_STAKE_AMOUNT / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
      })

      it('transfers to lock', async () => {
        await approveAndStake()
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        await staking.increaseLockAllowance(user2, DEFAULT_LOCK_AMOUNT, { from: user1 })
        await staking.transfer(user1, user2, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // lock has increased amount now
        const _amount = (await staking.getLock(user1, user2))[0]
        assert.equal(_amount.toString(), DEFAULT_LOCK_AMOUNT * 2, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT * 2, "Total stake should match")
      })

      it('fails transferring zero tokens', async () => {
        await approveAndStake()
        await assertRevert(staking.transfer(user1, ZERO_ADDRESS, 0), STAKING_ERRORS.ERROR_AMOUNT_ZERO)
      })

      it('fails transferring more than unlocked balance', async () => {
        await approveAndStake(DEFAULT_STAKE_AMOUNT)
        await assertRevert(staking.transfer(user1, ZERO_ADDRESS, DEFAULT_STAKE_AMOUNT + 1), STAKING_ERRORS.ERROR_NOT_ENOUGH_BALANCE)
      })
    })

    context('From Lock', async () => {
      it('transfers', async () => {
        await approveStakeAndLock(lockManager.address)
        const transferAmount = DEFAULT_LOCK_AMOUNT / 2
        await lockManager.transferFromLock(staking.address, owner, user1, ZERO_ADDRESS, transferAmount)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), transferAmount, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const { _amount: amount, _data: data }  = await staking.getLock(owner, lockManager.address)
        assert.equal(amount, DEFAULT_LOCK_AMOUNT - transferAmount, "locked amount should match")
      })

      it('transfers the whole lock amount', async () => {
        await approveStakeAndLock(lockManager.address)
        await lockManager.transferFromLock(staking.address, owner, user1, ZERO_ADDRESS, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const { _amount: amount, _data: data }  = await staking.getLock(owner, lockManager.address)
        assert.equal(amount, 0, "locked amount should match")
      })

      it('transfers to lock', async () => {
        await approveStakeAndLock(lockManager.address)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        await staking.increaseLockAllowance(user2, DEFAULT_LOCK_AMOUNT, { from: user1 })
        await lockManager.transferFromLock(staking.address, owner, user1, user2, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // lock has increased amount now
        const amount = (await staking.getLock(user1, user2))[0]
        assert.equal(amount.toString(), DEFAULT_LOCK_AMOUNT * 2, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT * 2, "Total stake should match")
      })

      it('fails transferring zero tokens', async () => {
        await approveStakeAndLock(lockManager.address)
        await assertRevert(lockManager.transferFromLock(staking.address, owner, user1, ZERO_ADDRESS, 0), STAKING_ERRORS.ERROR_AMOUNT_ZERO)
      })

      it('fails transferring more than locked balance', async () => {
        await approveStakeAndLock(lockManager.address)
        await assertRevert(lockManager.transferFromLock(staking.address, owner, user1, ZERO_ADDRESS, DEFAULT_LOCK_AMOUNT + 1), STAKING_ERRORS.ERROR_NOT_ENOUGH_LOCK)
      })

      it('fails if sender is not manager', async () => {
        await approveStakeAndLock(lockManager.address)
        await assertRevert(staking.transferFromLock(owner, user1, ZERO_ADDRESS, DEFAULT_LOCK_AMOUNT, { from: user1 }), STAKING_ERRORS.ERROR_NOT_ENOUGH_LOCK)
      })

      it('fails transferring from unlocked lock', async () => {
        await approveStakeAndLock(user1)
        // unlock
        await staking.decreaseAndRemoveManager(owner, user1, { from: user1 })
        await assertRevert(staking.transferFromLock(owner, user2, ZERO_ADDRESS, DEFAULT_LOCK_AMOUNT, { from: user1 }), STAKING_ERRORS.ERROR_NOT_ENOUGH_LOCK)
      })

      it('fails transferring to unlocked lock', async () => {
        await approveStakeAndLock(lockManager.address)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        // unlock
        await staking.decreaseAndRemoveManager(user1, user2, { from: user2 })
        await assertRevert(lockManager.transferFromLock(staking.address, owner, user1, user2, DEFAULT_LOCK_AMOUNT), STAKING_ERRORS.ERROR_NOT_ENOUGH_ALLOWANCE)
      })
    })
  })
})
