const { sha3 } = require('web3-utils')
const { assertRevert } = require('@aragon/contract-helpers-test/assertThrow')
const { getEventArgument, decodeEvents } = require('@aragon/contract-helpers-test/events')

const { deploy } = require('./helpers/deploy')(artifacts)
const { DEFAULT_STAKE_AMOUNT, DEFAULT_LOCK_AMOUNT, EMPTY_DATA } = require('./helpers/constants')
const { STAKING_ERRORS } = require('./helpers/errors')

const BadLockManager = artifacts.require('BadLockManagerMock')

const getDeepEventArgument = (receipt, contractAbi, eventName, argument, index=0) => {
  const logs = decodeEvents(receipt.receipt, contractAbi, eventName)
  return logs[index].args[argument]
}

const LockManagerMock = artifacts.require('LockManagerMock');

contract('Staking app, Locking and calling', ([owner, user1, user2]) => {
  let staking, token, lockManager

  const CALLBACK_DATA = sha3('receiveLock(uint256,uint256,bytes)').slice(0, 10)

  beforeEach(async () => {
    const deployment = await deploy(user1)
    token = deployment.token
    staking = deployment.staking
    lockManager = deployment.lockManager
  })

  const approveStakeAndLock = async (data) => {
    await token.approve(staking.address, DEFAULT_STAKE_AMOUNT, { from: user1 })
    await staking.stake(DEFAULT_STAKE_AMOUNT, EMPTY_DATA, { from: user1 })
    const receipt = await staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })

    return receipt
  }

  const checkCallbackLog = (receipt, data, lockAmount = DEFAULT_LOCK_AMOUNT) => {
    assert.equal(getDeepEventArgument(receipt, LockManagerMock.abi, 'LogLockCallback', 'amount'), lockAmount, 'Amount in callback should match')
    assert.equal(getDeepEventArgument(receipt, LockManagerMock.abi, 'LogLockCallback', 'allowance'), DEFAULT_STAKE_AMOUNT, 'Allowance in callback should match')
    assert.equal(getDeepEventArgument(receipt, LockManagerMock.abi, 'LogLockCallback', 'data'), data, 'Data in callback should match')
  }

  describe('allows lock manager and locks', () => {
    it('and calls lock manager, with just the signature', async () => {
      const data = CALLBACK_DATA
      const receipt = await approveStakeAndLock(data)
      checkCallbackLog(receipt, data)
    })

    it('and calls lock manager, with added data', async () => {
      const data = CALLBACK_DATA + '0'.repeat(63) + '1'
      const receipt = await approveStakeAndLock(data)
      checkCallbackLog(receipt, data)
    })

    it('but doesn’t call lock manager without proper data', async () => {
      // some random data
      const data = '0x1234'
      const receipt = await approveStakeAndLock(data)

      assert.equal(decodeEvents(receipt.receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })

    it('but doesn’t call lock manager with empty data', async () => {
      const receipt = await approveStakeAndLock(EMPTY_DATA)

      assert.equal(decodeEvents(receipt.receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })
  })

  describe('allows lock manager without locking', () => {
    it('and calls lock manager, with just the signature', async () => {
      const data = CALLBACK_DATA
      const receipt = await staking.allowManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })
      checkCallbackLog(receipt, data, 0)
    })

    it('and calls lock manager, with added data', async () => {
      const data = CALLBACK_DATA + '0'.repeat(63) + '1'
      const receipt = await staking.allowManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })
      checkCallbackLog(receipt, data, 0)
    })

    it('but doesn’t call lock manager without proper data', async () => {
      // some random data
      const data = '0x1234'
      const receipt = await staking.allowManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })

      assert.equal(decodeEvents(receipt.receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })

    it('but doesn’t call lock manager with empty data', async () => {
      const data = EMPTY_DATA
      const receipt = await staking.allowManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })

      assert.equal(decodeEvents(receipt.receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })
  })

  describe('Bad lock manager', () => {
    it('fails calling if lock manager doesn’t return true', async () => {
      const badLockManager = await BadLockManager.new()

      await token.approve(staking.address, DEFAULT_STAKE_AMOUNT, { from: user1 })
      await staking.stake(DEFAULT_STAKE_AMOUNT, EMPTY_DATA, { from: user1 })

      await assertRevert(staking.allowManagerAndLock(DEFAULT_LOCK_AMOUNT, badLockManager.address, DEFAULT_STAKE_AMOUNT, CALLBACK_DATA, { from: user1 }), STAKING_ERRORS.STAKING_LOCKMANAGER_CALL_FAIL)
    })

  })

})
