const { sha3 } = require('web3-utils')
const { getEventArgument, decodeEvents } = require('@aragon/contract-helpers-test/events')
const logsToRawLogs = r => {
  r.receipt.rawLogs = r.receipt.logs
  return r.receipt
}

const getDeepEventLogs = (receipt, contractAbi, eventName) => {
  return decodeEvents(logsToRawLogs(receipt), contractAbi, eventName)
}
const getDeepEventArgument = (receipt, contractAbi, eventName, argument, index=0) => {
  const logs = getDeepEventLogs(receipt, contractAbi, eventName)
  return logs[index].args[argument]
}

const StakingFactory = artifacts.require('StakingFactory');
const Staking = artifacts.require('Staking');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const LockManagerMock = artifacts.require('LockManagerMock');

contract('Staking app, Locking and calling', ([owner, user1, user2]) => {
  let staking, token, lockManager

  const DEFAULT_STAKE_AMOUNT = 120
  const DEFAULT_LOCK_AMOUNT = DEFAULT_STAKE_AMOUNT / 3
  const EMPTY_DATA = '0x'
  const CALLBACK_DATA = sha3('receiveLock(uint256,uint256,bytes)').slice(0, 10)

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_STAKE_AMOUNT
    token = await StandardTokenMock.new(user1, initialAmount)

    const factory = await StakingFactory.new()
    const receipt = await factory.getOrCreateInstance(token.address)
    const stakingAddress = getEventArgument(receipt, 'NewStaking', 'instance')
    staking = Staking.at(stakingAddress)

    lockManager = await LockManagerMock.new()
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

      assert.equal(getDeepEventLogs(receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })

    it('but doesn’t call lock manager with empty data', async () => {
      const receipt = await approveStakeAndLock(EMPTY_DATA)

      assert.equal(getDeepEventLogs(receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })
  })

  describe('allows lock manager without locking', () => {
    it('and calls lock manager, with just the signature', async () => {
      const data = CALLBACK_DATA
      const receipt = await staking.allowNewLockManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })
      checkCallbackLog(receipt, data, 0)
    })

    it('and calls lock manager, with added data', async () => {
      const data = CALLBACK_DATA + '0'.repeat(63) + '1'
      const receipt = await staking.allowNewLockManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })
      checkCallbackLog(receipt, data, 0)
    })

    it('but doesn’t call lock manager without proper data', async () => {
      // some random data
      const data = '0x1234'
      const receipt = await staking.allowNewLockManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })

      assert.equal(getDeepEventLogs(receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })

    it('but doesn’t call lock manager with empty data', async () => {
      const data = EMPTY_DATA
      const receipt = await staking.allowNewLockManager(lockManager.address, DEFAULT_STAKE_AMOUNT, data, { from: user1 })

      assert.equal(getDeepEventLogs(receipt, LockManagerMock.abi, 'LogLockCallback').length, 0, 'There should be no logs')
    })
  })
})
