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
    await staking.allowManagerAndLock(lockAmount, manager, lockAmount, EMPTY_STRING, { from })
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
        await approveStakeAndLock(lockManager.address)
        const transferAmount = DEFAULT_LOCK_AMOUNT / 2
        await lockManager.transferFromLock(staking.address, owner, user1, 0, transferAmount)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), transferAmount, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const [ amount, data ]  = await staking.getLock(owner, lockManager.address)
        assert.equal(amount, DEFAULT_LOCK_AMOUNT - transferAmount, "locked amount should match")
      })

      it('transfers the whole lock amount', async () => {
        await approveStakeAndLock(lockManager.address)
        await lockManager.transferFromLock(staking.address, owner, user1, 0, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), DEFAULT_LOCK_AMOUNT, "User 1 balance should match")
        // total stake remains the same
        assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
        // check lock values
        const [amount, data ] = await staking.getLock(owner, lockManager.address)
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

      it('fails transfering zero tokens', async () => {
        await approveStakeAndLock(lockManager.address)
        await assertRevert(lockManager.transferFromLock(staking.address, owner, user1, 0, 0))
      })

      it('fails transfering more than locked balance', async () => {
        await approveStakeAndLock(lockManager.address)
        await assertRevert(lockManager.transferFromLock(staking.address, owner, user1, 0, DEFAULT_LOCK_AMOUNT + 1))
      })

      it('fails if sender is not manager', async () => {
        await approveStakeAndLock(lockManager.address)
        await assertRevert(staking.transferFromLock(owner, user1, 0, DEFAULT_LOCK_AMOUNT, { from: user1 }))
      })

      it('fails transfering from unlocked lock', async () => {
        await approveStakeAndLock(user1)
        // unlock
        await staking.decreaseAndRemoveManager(owner, user1, { from: user1 })
        await assertRevert(staking.transferFromLock(owner, user2, 0, DEFAULT_LOCK_AMOUNT, { from: user1 }))
      })

      it('fails transfering to unlocked lock', async () => {
        await approveStakeAndLock(lockManager.address)
        await token.mint(user1, DEFAULT_STAKE_AMOUNT)
        await approveStakeAndLock(user2, DEFAULT_LOCK_AMOUNT, DEFAULT_STAKE_AMOUNT, user1)
        // unlock
        await staking.decreaseAndRemoveManager(user1, user2, { from: user2 })
        await assertRevert(lockManager.transferFromLock(staking.address, owner, user1, user2, DEFAULT_LOCK_AMOUNT))
      })
    })
  })
})
