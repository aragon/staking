const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event == event)[0].args[arg] }

const Staking = artifacts.require('StakingMock');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const LockManagerMock = artifacts.require('LockManagerMock');

contract('Staking app, Locking max locks', accounts => {
  let staking, token, lockManager, stakingAddress, tokenAddress
  let owner, user1

  const zeroBytes = "0x"
  const MAX_UINT64 = (new web3.BigNumber(2)).pow(new web3.BigNumber(64)).sub(new web3.BigNumber(1))
  const DEFAULT_STAKE_AMOUNT = 120
  const DEFAULT_LOCK_AMOUNT = DEFAULT_STAKE_AMOUNT / 3
  const EMPTY_STRING = ''
  let MAX_LOCKS

  const approveAndStake = async (amount = DEFAULT_STAKE_AMOUNT, from = owner) => {
    await token.approve(stakingAddress, amount, { from })
    await staking.stake(amount, EMPTY_STRING, { from })
  }

  const approveStakeAndLockMany = async (
    number,
    manager,
    lockAmount = DEFAULT_LOCK_AMOUNT,
    stakeAmount = DEFAULT_STAKE_AMOUNT,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    const r = await staking.lockMany(number, lockAmount, manager, EMPTY_STRING, { from })
  }

  const approveStakeAndLock = async (
    manager,
    lockAmount = DEFAULT_LOCK_AMOUNT,
    stakeAmount = DEFAULT_STAKE_AMOUNT,
    from = owner
  ) => {
    await approveAndStake(stakeAmount, from)
    const r = await staking.lock(lockAmount, manager, EMPTY_STRING, { from })
    const lockId = getEvent(r, 'Locked', 'lockId')

    return lockId
  }

  before(async () => {
    owner = accounts[0]
    user1 = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = 5000 * DEFAULT_STAKE_AMOUNT
    token = await StandardTokenMock.new(owner, initialAmount)
    tokenAddress = token.address
    staking = await Staking.new(tokenAddress)
    MAX_LOCKS = await staking.getMaxLocks()
    stakingAddress = staking.address
  })

  it('fails locking more than max allowed locks', async () => {
    const STEP = 80
    let locks = MAX_LOCKS.toNumber()
    while (locks > 0) {
      const number = Math.min(STEP, locks)
      await approveStakeAndLockMany(number, user1, 1, number)
      locks -= number
    }
    return assertRevert(async () => {
      await approveStakeAndLock(user1)
    })
  })
})
