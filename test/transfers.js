const { assertRevert } = require('@aragon/contract-helpers-test/assertThrow')
const { bn, MAX_UINT64 } = require('@aragon/contract-helpers-test/numbers')

const { deploy } = require('./helpers/deploy')(artifacts)
const { approveAndStake, approveStakeAndLock } = require('./helpers/helpers')(artifacts)
const { DEFAULT_STAKE_AMOUNT, DEFAULT_LOCK_AMOUNT, EMPTY_DATA, ZERO_ADDRESS } = require('./helpers/constants')
const { STAKING_ERRORS } = require('./helpers/errors')

contract('Staking app, Transferring', ([owner, user1, user2]) => {
  let staking, token, lockManager

  beforeEach(async () => {
    const deployment = await deploy(owner)
    token = deployment.token
    staking = deployment.staking
    lockManager = deployment.lockManager
  })

  context('Transfers', async () => {

    context('From stake', async () => {

      const transfersFromStake = (transferType) => {
        it('transfers', async () => {
          //const initialTotalStake = await staking.totalStaked()
          const transferAmount = DEFAULT_STAKE_AMOUNT.div(bn(2))
          await approveAndStake({ staking, from: owner })
          await staking[transferType](user1, transferAmount)

          assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - transferAmount, "Owner balance should match")

          const userStakedBalance = transferType == 'transfer' ? transferAmount : 0
          assert.equal((await staking.unlockedBalanceOf(user1)).toString(), userStakedBalance, "User 1 unlocked balance should match")

          const userExternalBalance = transferType == 'transfer' ? 0 : transferAmount
          assert.equal((await token.balanceOf(user1)).toString(), userExternalBalance, "User 1 external balance should match")

          // total stake
          const totalStaked = transferType == 'transfer' ? DEFAULT_STAKE_AMOUNT : DEFAULT_STAKE_AMOUNT - transferAmount
          assert.equal((await staking.totalStaked()).toString(), totalStaked, "Total stake should match")
        })

        it('fails transferring zero tokens', async () => {
          await approveAndStake({ staking, from: owner })
          await assertRevert(staking[transferType](user1, 0), STAKING_ERRORS.ERROR_AMOUNT_ZERO)
        })

        it('fails transferring more than staked balance', async () => {
          await approveAndStake({ staking, amount: DEFAULT_STAKE_AMOUNT, from: owner })
          await assertRevert(staking[transferType](user1, DEFAULT_STAKE_AMOUNT + 1), STAKING_ERRORS.ERROR_NOT_ENOUGH_BALANCE)
        })

        it('fails transferring more than unlocked balance', async () => {
          await approveStakeAndLock({ staking, manager: lockManager.address, from: owner })
          await assertRevert(staking[transferType](user1, DEFAULT_STAKE_AMOUNT), STAKING_ERRORS.ERROR_NOT_ENOUGH_BALANCE)
        })
      }

      context('within Staking app', () => {
        transfersFromStake('transfer')
      })

      context('to external balance (unstaked)', () => {
        transfersFromStake('transferAndUnstake')
      })
    })

    const transfersFromLock = (transferType) => {
      it('transfers', async () => {
        await approveStakeAndLock({ staking, manager: lockManager.address, from: owner })
        const transferAmount = DEFAULT_LOCK_AMOUNT.div(bn(2))
        await lockManager[transferType](staking.address, owner, user1, transferAmount)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        const userUnlockedBalance = transferType == 'slash' ? transferAmount : 0
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), userUnlockedBalance, "User 1 unlocked balance should match")

        const userExternalBalance = transferType == 'slash' ? 0 : transferAmount
        assert.equal((await token.balanceOf(user1)).toString(), userExternalBalance, "User 1 external balance should match")

        // total stake
        const totalStaked = transferType == 'slash' ? DEFAULT_STAKE_AMOUNT : DEFAULT_STAKE_AMOUNT - transferAmount
        assert.equal((await staking.totalStaked()).toString(), totalStaked, "Total stake should match")

        // check lock values
        const { _amount: amount, _data: data }  = await staking.getLock(owner, lockManager.address)
        assert.equal(amount, DEFAULT_LOCK_AMOUNT - transferAmount, "locked amount should match")
      })

      it('transfers the whole lock amount', async () => {
        await approveStakeAndLock({ staking, manager: lockManager.address, from: owner })
        await lockManager[transferType](staking.address, owner, user1, DEFAULT_LOCK_AMOUNT)

        assert.equal((await staking.unlockedBalanceOf(owner)).toString(), DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT, "Owner balance should match")
        const userUnlockedBalance = transferType == 'slash' ? DEFAULT_LOCK_AMOUNT : 0
        assert.equal((await staking.unlockedBalanceOf(user1)).toString(), userUnlockedBalance, "User 1 unlocked balance should match")

        const userExternalBalance = transferType == 'slash' ? 0 : DEFAULT_LOCK_AMOUNT
        assert.equal((await token.balanceOf(user1)).toString(), userExternalBalance, "User 1 external balance should match")

        // total stake
        const totalStaked = transferType == 'slash' ? DEFAULT_STAKE_AMOUNT : DEFAULT_STAKE_AMOUNT - DEFAULT_LOCK_AMOUNT
        assert.equal((await staking.totalStaked()).toString(), totalStaked, "Total stake should match")

        // check lock values
        const { _amount: amount, _data: data }  = await staking.getLock(owner, lockManager.address)
        assert.equal(amount, 0, "locked amount should match")
      })

      it('fails transferring zero tokens', async () => {
        await approveStakeAndLock({ staking, manager: lockManager.address, from: owner })
        await assertRevert(lockManager[transferType](staking.address, owner, user1, 0), STAKING_ERRORS.ERROR_AMOUNT_ZERO)
      })

      it('fails transferring more than locked balance', async () => {
        await approveStakeAndLock({ staking, manager: lockManager.address, from: owner })
        await assertRevert(lockManager[transferType](staking.address, owner, user1, DEFAULT_LOCK_AMOUNT + 1), STAKING_ERRORS.ERROR_NOT_ENOUGH_LOCK)
      })

      it('fails if sender is not manager', async () => {
        await approveStakeAndLock({ staking, manager: user1, from: owner })
        await assertRevert(lockManager[transferType](staking.address, owner, user1, DEFAULT_LOCK_AMOUNT), STAKING_ERRORS.ERROR_NOT_ENOUGH_LOCK)
      })

      it('fails transferring from unlocked lock', async () => {
        await approveStakeAndLock({ staking, manager: lockManager.address, from: owner })
        // unlock
        await lockManager.unlockAndRemoveManager(staking.address, owner)
        await assertRevert(lockManager[transferType](staking.address, owner, user2, DEFAULT_LOCK_AMOUNT, { from: user1 }), STAKING_ERRORS.ERROR_NOT_ENOUGH_LOCK)
      })
    }

    context('From Lock', async () => {
      context('within Staking app', () => {
        transfersFromLock('slash')
      })

      context('to external balance (unstaked)', () => {
        transfersFromLock('slashAndUnstake')
      })
    })
  })
})
