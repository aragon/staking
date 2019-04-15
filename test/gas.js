const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event == event)[0].args[arg] }

const Staking = artifacts.require('StakingMock');
const StandardTokenMock = artifacts.require('StandardTokenMock');
const LockManagerMock = artifacts.require('LockManagerMock');

contract.skip('Staking app, gas measures', accounts => {
  let staking, token, lockManager, stakingAddress, tokenAddress, lockManagerAddress
  let owner, user1, user2

  const zeroBytes = "0x"
  const MAX_UINT64 = (new web3.BigNumber(2)).pow(new web3.BigNumber(64)).sub(new web3.BigNumber(1))
  const DEFAULT_STAKE_AMOUNT = 1200
  const DEFAULT_LOCK_AMOUNT = DEFAULT_STAKE_AMOUNT / 30
  const EMPTY_STRING = ''

  const approveAndStake = async (amount = DEFAULT_STAKE_AMOUNT, from = owner) => {
    await token.approve(stakingAddress, amount, { from })
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
    const tokenContract = await StandardTokenMock.new(owner, initialAmount)
    token = tokenContract
    tokenAddress = tokenContract.address
    const stakingContract = await Staking.new(tokenAddress)
    staking = stakingContract
    stakingAddress = stakingContract.address
    const lockManagerContract = await LockManagerMock.new()
    lockManager = lockManagerContract
    lockManagerAddress = lockManagerContract.address
  })

  // increases 1185 gas for each lock
  it('measures unlockedBalanceOf gas', async () => {
    for (let i = 0; i < 10; i++)  {
      await approveStakeAndLock(lockManagerAddress)

      const r = await staking.unlockedBalanceOfGas()
      const gas = getEvent(r, 'LogGas', 'gas')
      console.log(`unlockedBalanceOf gas with ${i} locks: ${gas.toNumber()}`)
    }
  })

  // 110973 gas
  it('measures lock gas', async () => {
    const lockId = await approveAndStake()

    const r = await staking.lockGas(DEFAULT_LOCK_AMOUNT, lockManagerAddress, EMPTY_STRING, { from: owner })
    const gas = getEvent(r, 'LogGas', 'gas')
    console.log('lock gas:', gas.toNumber())
  })

  // 27601 gas
  it('measures transfer gas', async () => {
    const lockId = await approveStakeAndLock(lockManagerAddress)

    const r = await staking.transferGas(owner, lockId, DEFAULT_LOCK_AMOUNT)
    const gas = getEvent(r, 'LogGas', 'gas')
    console.log('transfer gas:', gas.toNumber())
  })

  //  gas
  it('measures unlock gas', async () => {
    for (let i = 0; i < 10; i++)  {
      const lockId = await approveStakeAndLock(user1)

      const r = await staking.unlockGas(owner, lockId, { from: user1 })
      const gas = getEvent(r, 'LogGas', 'gas')
      console.log(`unlock gas with ${i} locks: ${gas.toNumber()}`)
      await approveStakeAndLock(lockManagerAddress)
    }
  })
})
