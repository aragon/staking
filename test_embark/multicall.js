const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const Staking = embark.require('Embark/contracts/Staking');
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock');
let accounts

config({}, (err, accts) => {accounts = accts})

contract('Staking app, Multicall', () => {
  let staking, token, stakingAddress, tokenAddress
  let owner, user1

  const zeroBytes = "0x00"
  const MAX_UINT64 = (new web3.utils.BN(2)).pow(new web3.utils.BN(64)).sub(new web3.utils.BN(1))
  const defaultAmount = 120

  before(async () => {
    owner = accounts[0]
    user1 = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = 1000 * defaultAmount
    const tokenContract = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    token = tokenContract.methods
    tokenAddress = tokenContract.options.address
    const stakingContract = await Staking.deploy({arguments: [tokenAddress]}).send()
    staking = stakingContract.methods
    stakingAddress = stakingContract.options.address
  })

  const signature = sigString => {
    return web3.utils.sha3(sigString).slice(0, 10)
  }
  const intParam = param => {
    return web3.utils.fromDecimal(param).slice(2).padStart(64, "0")
  }
  const addressParam = param => {
    return param.slice(2).padStart(64, "0")
  }

  it('stakes and locks in one transaction', async () => {
    await token.approve(stakingAddress, defaultAmount).send()
    const stakeCall = signature("stake(uint256,bytes)") + web3.eth.abi.encodeParameters(['uint256', 'bytes'], [defaultAmount, zeroBytes]).slice(2)
    const lockCall = signature("lock(uint256,address,bytes)") + web3.eth.abi.encodeParameters(['uint256', 'address', 'bytes'], [defaultAmount / 2, user1, zeroBytes]).slice(2)
    //const r = await staking.multicall([stakeCall, lockCall]).send()
    const r = await staking.multicall(stakeCall, lockCall).send()
    const lockId = getEvent(r, 'Locked', 'lockId')

    // check lock values
    const lock = await staking.getLock(owner, lockId).call()
    assert.equal(lock[0], defaultAmount / 2, "locked amount should match")
    assert.equal(lock[1].toString(), MAX_UINT64.toString(), "unlock time should match")
    assert.equal(lock[2], user1, "unlocker should match")
    assert.equal(lock[3], zeroBytes, "lock data should match")

    assert.equal((await staking.unlockedBalanceOf(owner).call()).valueOf(), defaultAmount / 2, "Unlocked balance should match")
    assert.equal((await staking.locksCount(owner).call()).valueOf(), parseInt(lockId, 10), "last lock id should match")
  })

  it('fails if second call in multicall fails', async () => {
    await token.approve(stakingAddress, defaultAmount).send()
    const stakeCall = signature("stake(uint256,bytes)") + web3.eth.abi.encodeParameters(['uint256', 'bytes'], [defaultAmount, zeroBytes]).slice(2)
    // lock will fail because of amount 0
    const lockCall = signature("lock(uint256,address,bytes)") + web3.eth.abi.encodeParameters(['uint256', 'address', 'bytes'], [0, user1, zeroBytes]).slice(2)
    return assertRevert(async () => {
      await staking.multicall(stakeCall, lockCall).send()
    })
  })

  it('fails if first call in multicall fails', async () => {
    // stake will fail because of amount 0
    await token.approve(stakingAddress, defaultAmount).send()
    const stakeCall1 = signature("stake(uint256,bytes)") + web3.eth.abi.encodeParameters(['uint256', 'bytes'], [0, zeroBytes]).slice(2)
    const stakeCall2 = signature("stake(uint256,bytes)") + web3.eth.abi.encodeParameters(['uint256', 'bytes'], [defaultAmount, zeroBytes]).slice(2)
    return assertRevert(async () => {
      await staking.multicall(stakeCall1, stakeCall2).send()
    })
  })
})
