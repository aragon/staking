const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const StakingMock = artifacts.require('StakingMock')
const MiniMeToken = artifacts.require('MiniMeToken')

const fromBn = n => parseInt(n.valueOf(), 10)
const getTokenBalance = async (token, account) =>  fromBn(await token.balanceOf(account))

contract('Staking app, Approve and call fallback', ([owner, user]) => {
  let staking, token, stakingAddress, tokenAddress

  const DEFAULT_AMOUNT = 120
  const EMPTY_STRING = ''
  const ZERO_ADDRESS = '0x' + '0'.repeat(40)

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_AMOUNT
    const tokenContract = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Test Token', 18, 'TT', true)
    token = tokenContract
    tokenAddress = tokenContract.address
    await token.generateTokens(user, DEFAULT_AMOUNT)
    const stakingContract = await StakingMock.new(tokenAddress)
    staking = stakingContract
    stakingAddress = stakingContract.address
  })

  it('stakes through approveAndCall', async () => {
    const initialUserBalance = await getTokenBalance(token, user)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    await token.approveAndCall(stakingAddress, DEFAULT_AMOUNT, EMPTY_STRING, { from: user })

    const finalUserBalance = await getTokenBalance(token, user)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalUserBalance, initialUserBalance - DEFAULT_AMOUNT, "user balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(user)).valueOf(), DEFAULT_AMOUNT, "staked value should match")
    // total stake
    assert.equal((await staking.totalStaked()).toString(), DEFAULT_AMOUNT, "Total stake should match")
  })

  it('fails staking 0 amount through approveAndCall', async () => {
    await assertRevert(token.approveAndCall(stakingAddress, 0, EMPTY_STRING, { from: user }))
  })

  it('fails calling approveAndCall on a different token', async () => {
    const token2 = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Test Token 2', 18, 'TT2', true)
    await token2.generateTokens(user, DEFAULT_AMOUNT)
    await assertRevert(token2.approveAndCall(stakingAddress, 0, EMPTY_STRING, { from: user }))
  })

  it('fails calling receiveApproval from a different account than the token', async () => {
    await assertRevert(staking.receiveApproval(user, DEFAULT_AMOUNT, tokenAddress, EMPTY_STRING))
  })
})
