const { assertRevert } = require('@aragon/contract-helpers-test/assertThrow')

const { DEFAULT_STAKE_AMOUNT, EMPTY_DATA, ZERO_ADDRESS } = require('./helpers/constants')

const StakingMock = artifacts.require('StakingMock')
const MiniMeToken = artifacts.require('MiniMeToken')

const fromBn = n => parseInt(n.valueOf(), 10)
const getTokenBalance = async (token, account) =>  fromBn(await token.balanceOf(account))

contract('Staking app, Approve and call fallback', ([owner, user]) => {
  let staking, token, stakingAddress, tokenAddress

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_STAKE_AMOUNT
    const tokenContract = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Test Token', 18, 'TT', true)
    token = tokenContract
    tokenAddress = tokenContract.address
    await token.generateTokens(user, DEFAULT_STAKE_AMOUNT)
    const stakingContract = await StakingMock.new(tokenAddress)
    staking = stakingContract
    stakingAddress = stakingContract.address
  })

  it('stakes through approveAndCall', async () => {
    const initialUserBalance = await getTokenBalance(token, user)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    await token.approveAndCall(stakingAddress, DEFAULT_STAKE_AMOUNT, EMPTY_DATA, { from: user })

    const finalUserBalance = await getTokenBalance(token, user)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalUserBalance, initialUserBalance - DEFAULT_STAKE_AMOUNT, "user balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_STAKE_AMOUNT, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(user)).valueOf(), DEFAULT_STAKE_AMOUNT, "staked value should match")
    // total stake
    assert.equal((await staking.totalStaked()).toString(), DEFAULT_STAKE_AMOUNT, "Total stake should match")
  })

  it('fails staking 0 amount through approveAndCall', async () => {
    await assertRevert(token.approveAndCall(stakingAddress, 0, EMPTY_DATA, { from: user }))
  })

  it('fails calling approveAndCall on a different token', async () => {
    const token2 = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Test Token 2', 18, 'TT2', true)
    await token2.generateTokens(user, DEFAULT_STAKE_AMOUNT)
    await assertRevert(token2.approveAndCall(stakingAddress, 0, EMPTY_DATA, { from: user }))
  })

  it('fails calling receiveApproval from a different account than the token', async () => {
    await assertRevert(staking.receiveApproval(user, DEFAULT_STAKE_AMOUNT, tokenAddress, EMPTY_DATA))
  })
})
