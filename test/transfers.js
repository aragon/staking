const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event === event)[0].args[arg] }

const Staking = artifacts.require('Staking');
const StakingFactory = artifacts.require('StakingFactory');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const LockManagerMock = artifacts.require('LockManagerMock');

contract('Staking app, Transferring', ([owner, user1, user2]) => {
  let staking, token, lockManager

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

  context('Transfers', async () => {
    context('From stake', async () => {
      it('transfers', async () => {
        //const initialTotalStake = await staking.totalStaked()
        await approveAndStake()
        await staking.transfer(user1, 0, DEFAULT_STAKE_AMOUNT / 2)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT / 2, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_STAKE_AMOUNT / 2, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
      })

      it('transfers to lock', async () => {
        await approveAndStake()
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        const lockId = await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        await staking.transfer(user1, lockId, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // lock has increased amount now
        const _amount = (await staking.getLock(user1, lockId))[0]
        assert.equal(_amount.toString(), DEFAULT_LOCK_AMOUNT * 2, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT * 2, "Total stake should match")
      })

      it('fails transfering zero tokens', async () => {
        await approveAndStake()
        await assertRevert(staking.transfer(user1, 0, 0))
      })

      it('fails transfering more than unlocked balance', async () => {
        await approveAndStake(DEFAULT_STAKE_AMOUNT)
        await assertRevert(staking.transfer(user1, 0, DEFAULT_STAKE_AMOUNT + 1))
      })
    })

    context('From Lock', async () => {
      it('transfers', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        const transferAmount = DEFAULT_LOCK_AMOUNT / 2
        await lockManager.transferFromLock(staking.address, owner, lockId, user1, 0, transferAmount)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), transferAmount, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const [ amount, unlockedAt, manager, data ]  = await staking.getLock(owner, lockId)
        assert.equal(amount, DEFAULT_LOCK_AMOUNT - transferAmount, "locked amount should match")
        assert.equal(unlockedAt.toString(), MAX_UINT64.toString(), "unlock time should match")
      })

      it('transfers the whole lock amount', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        await lockManager.transferFromLock(staking.address, owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const [amount, unlockedAt, manager, data ] = await staking.getLock(owner, lockId)
        assert.equal(amount, 0, "locked amount should match")
        assert.notEqual(unlockedAt.toString(), MAX_UINT64.toString(), "unlock time should  be a 'real' number")
      })

      it('transfers to lock', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        const toLockId = await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        await lockManager.transferFromLock(staking.address, owner, lockId, user1, toLockId, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // lock has increased amount now
        const amount = (await staking.getLock(user1, lockId))[0]
        assert.equal(amount.toString(), DEFAULT_LOCK_AMOUNT * 2, "Lock amount should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT * 2, "Total stake should match")
      })

      it('fails if lockId is zero', async () => {
        await approveStakeAndLock(lockManager.address)

        // it will fail at isLockManager modifier
        await assertRevert(lockManager.transferFromLock(staking.address, owner, 0, user1, 0, DEFAULT_LOCK_AMOUNT))
      })

      it('fails transfering zero tokens', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        await assertRevert(lockManager.transferFromLock(staking.address, owner, lockId, user1, 0, 0))
      })

      it('fails transfering more than locked balance', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        await assertRevert(lockManager.transferFromLock(staking.address, owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT + 1))
      })

      it('fails if sender is not manager', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        await assertRevert(staking.transferFromLock(owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT, { from: user1 }))
      })

      it('fails transfering from unlocked lock', async () => {
        const lockId = await approveStakeAndLock(user1)
        // unlock
        await staking.unlock(owner, lockId, { from: user1 })
        await assertRevert(lockManager.transferFromLock(staking.address, owner, lockId, user1, 0, DEFAULT_LOCK_AMOUNT))
      })

      it('fails transfering to unlocked lock', async () => {
        const lockId = await approveStakeAndLock(lockManager.address)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        const toLockId = await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        // unlock
        await staking.unlock(user1, toLockId, { from: user2 })
        await assertRevert(lockManager.transferFromLock(staking.address, owner, lockId, user1, toLockId, DEFAULT_LOCK_AMOUNT))
      })
    })
  })
})
