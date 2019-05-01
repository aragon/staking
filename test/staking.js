const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const StakingMock = artifacts.require('StakingMock')
const StandardTokenMock = artifacts.require('StandardTokenMock')
const BadTokenMock = artifacts.require('BadTokenMock')

const fromBn = n => parseInt(n.valueOf(), 10)
const getTokenBalance = async (token, account) =>  fromBn(await token.balanceOf(account))

contract('Staking app', ([owner, other]) => {
  let staking, token, stakingAddress, tokenAddress

  const DEFAULT_AMOUNT = 120
  const EMPTY_STRING = ''

  const approveAndStake = async (amount = DEFAULT_AMOUNT, from = owner) => {
    // allow Staking app to move owner tokens
    await token.approve(stakingAddress, amount, { from })
    // stake tokens
    await staking.stake(amount, EMPTY_STRING, { from })
  }

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_AMOUNT
    const tokenContract = await StandardTokenMock.new(owner, initialAmount)
    token = tokenContract
    tokenAddress = tokenContract.address
    await token.mint(other, DEFAULT_AMOUNT)
    const stakingContract = await StakingMock.new(tokenAddress)
    staking = stakingContract
    stakingAddress = stakingContract.address
  })

  it('has correct initial state', async () => {
    assert.equal(await staking.token(), tokenAddress, "Token is wrong")
    assert.equal((await staking.totalStaked()).valueOf(), 0, "Initial total staked amount should be zero")
    assert.equal(await staking.supportsHistory(), true, "history support should match")
  })

  it('fails deploying if token is not a contract', async() => {
    await assertRevert(StakingMock.new(owner))
  })

  it('stakes', async () => {
    const initialOwnerBalance = await getTokenBalance(token, owner)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    await approveAndStake()

    const finalOwnerBalance = await getTokenBalance(token, owner)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalOwnerBalance, initialOwnerBalance - DEFAULT_AMOUNT, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner)).valueOf(), DEFAULT_AMOUNT, "staked value should match")
    // total stake
    assert.equal((await staking.totalStaked()).toString(), DEFAULT_AMOUNT, "Total stake should match")
  })

  it('fails staking 0 amount', async () => {
    await token.approve(stakingAddress, 1)
    await assertRevert(staking.stake(0, EMPTY_STRING))
  })

  it('fails staking more than balance', async () => {
    const balance = await getTokenBalance(token, owner)
    const amount = balance + 1
    await token.approve(stakingAddress, amount)
    await assertRevert(staking.stake(amount, EMPTY_STRING))
  })

  it('stakes for', async () => {
    const initialOwnerBalance = await getTokenBalance(token, owner)
    const initialOtherBalance = await getTokenBalance(token, other)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    // allow Staking app to move owner tokens
    await token.approve(stakingAddress, DEFAULT_AMOUNT)
    // stake tokens
    await staking.stakeFor(other, DEFAULT_AMOUNT, EMPTY_STRING)

    const finalOwnerBalance = await getTokenBalance(token, owner)
    const finalOtherBalance = await getTokenBalance(token, other)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalOwnerBalance, initialOwnerBalance - DEFAULT_AMOUNT, "owner balance should match")
    assert.equal(finalOtherBalance, initialOtherBalance, "other balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT, "Staking app balance should match")
    assert.equal(fromBn(await staking.totalStakedFor(owner)), 0, "staked value for owner should match")
    assert.equal(fromBn(await staking.totalStakedFor(other)), DEFAULT_AMOUNT, "staked value for other should match")
  })

  it('unstakes', async () => {
    const initialOwnerBalance = await getTokenBalance(token, owner)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    await approveAndStake()

    // unstake half of them
    await staking.unstake(DEFAULT_AMOUNT / 2, EMPTY_STRING)

    const finalOwnerBalance = await getTokenBalance(token, owner)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalOwnerBalance, initialOwnerBalance - DEFAULT_AMOUNT / 2, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT / 2, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner)).valueOf(), DEFAULT_AMOUNT / 2, "staked value should match")
  })

  it('fails unstaking 0 amount', async () => {
    await approveAndStake()
    await assertRevert(staking.unstake(0, EMPTY_STRING))
  })

  it('fails unstaking more than staked', async () => {
    await approveAndStake()
    await assertRevert(staking.unstake(DEFAULT_AMOUNT + 1, EMPTY_STRING))
  })

  context('History', async () => {
    it('supports history', async () => {
      assert.equal(await staking.supportsHistory(), true, "It should support History")
    })

    it('has correct "last staked for"', async () => {
      const blockNumber = await staking.getBlockNumberPublic()
      const lastStaked = blockNumber + 5
      await staking.setBlockNumber(lastStaked)
      await approveAndStake()
      assert.equal(await staking.lastStakedFor(owner), lastStaked, "Last staked for should match")
    })

    it('has correct "total staked for at"', async () => {
      const beforeBlockNumber = await staking.getBlockNumberPublic()
      const lastStaked = beforeBlockNumber + 5
      await staking.setBlockNumber(lastStaked)
      await approveAndStake()
      assert.equal(await staking.totalStakedForAt(owner, beforeBlockNumber), 0, "Staked for at before staking should match")
      assert.equal(await staking.totalStakedForAt(owner, lastStaked), DEFAULT_AMOUNT, "Staked for after staking should match")
    })

    it('has correct "total staked at"', async () => {
      const beforeBlockNumber = await staking.getBlockNumberPublic()
      const lastStaked = beforeBlockNumber + 5
      await staking.setBlockNumber(lastStaked)
      await approveAndStake(DEFAULT_AMOUNT, owner)
      await approveAndStake(DEFAULT_AMOUNT, other)
      assert.equal(await staking.totalStakedAt(beforeBlockNumber), 0, "Staked for at before should match")
      assert.equal(await staking.totalStakedAt(lastStaked), DEFAULT_AMOUNT * 2, "Staked for at after staking should match")
    })
  })

  context('Bad Token', async () => {
    let badStaking, badStakingAddress, badToken, badTokenAddress
    beforeEach(async () => {
      const initialAmount = 1000 * DEFAULT_AMOUNT
      const tokenContract = await BadTokenMock.new(owner, initialAmount)
      badToken = tokenContract
      badTokenAddress = tokenContract.address
      await badToken.mint(other, DEFAULT_AMOUNT)
      const stakingContract = await StakingMock.new(badTokenAddress)
      badStaking = stakingContract
      badStakingAddress = stakingContract.address
    })

    it('fails unstaking because of bad token', async () => {
      // allow Staking app to move owner tokens
      await badToken.approve(badStakingAddress, DEFAULT_AMOUNT, { from: owner })
      // stake tokens
      await badStaking.stake(DEFAULT_AMOUNT, EMPTY_STRING, { from: owner })

      // unstake half of them, fails on token transfer
      await assertRevert(badStaking.unstake(DEFAULT_AMOUNT / 2, EMPTY_STRING))
    })
  })
})
