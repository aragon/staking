const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const StakingMock = embark.require('Embark/contracts/StakingMock')
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock')
const BadTokenMock = embark.require('Embark/contracts/BadTokenMock')

let accounts

const fromBn = n => parseInt(n.valueOf(), 10)
const getTokenBalance = async (token, account) =>  fromBn(await token.balanceOf(account).call())

config({}, (err, accts) => accounts = accts)

contract('Staking app', () => {
  let staking, token, stakingAddress, tokenAddress, owner, other

  const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  const DEFAULT_AMOUNT = 120
  const EMPTY_STRING = web3.utils.asciiToHex('')

  const approveAndStake = async (amount = DEFAULT_AMOUNT, from = owner) => {
    // allow Staking app to move owner tokens
    await token.approve(stakingAddress, amount).send({ from })
    // stake tokens
    await staking.stake(amount, EMPTY_STRING).send({ from })
  }

  before(async () => {
    owner = accounts[0]
    other = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = 1000 * DEFAULT_AMOUNT
    const tokenContract = await StandardTokenMock.deploy({ arguments: [owner, initialAmount] }).send()
    token = tokenContract.methods
    tokenAddress = tokenContract.options.address
    await token.mint(other, DEFAULT_AMOUNT).send()
    const stakingContract = await StakingMock.deploy({arguments: [tokenAddress]}).send()
    staking = stakingContract.methods
    stakingAddress = stakingContract.options.address
  })

  it('has correct initial state', async () => {
    assert.equal(await staking.token().call(), tokenAddress, "Token is wrong")
    assert.equal((await staking.totalStaked().call()).valueOf(), 0, "Initial total staked amount should be zero")
    assert.equal(await staking.supportsHistory().call(), true, "history support should match")
  })

  it('fails deploying if token is not a contract', async() => {
    return assertRevert(async () => {
      await StakingMock.deploy({arguments: [owner]}).send()
    })
  })

  it('stakes', async () => {
    const initialOwnerBalance = await getTokenBalance(token, owner)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    await approveAndStake()

    const finalOwnerBalance = await getTokenBalance(token, owner)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalOwnerBalance, initialOwnerBalance - DEFAULT_AMOUNT, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner).call()).valueOf(), DEFAULT_AMOUNT, "staked value should match")
    // total stake
    assert.equal((await staking.totalStaked().call()).toString(), DEFAULT_AMOUNT, "Total stake should match")
  })

  it('fails staking 0 amount', async () => {
    await token.approve(stakingAddress, 1).send()
    return assertRevert(async () => {
      await staking.stake(0, EMPTY_STRING).send()
    })
  })

  it('fails staking more than balance', async () => {
    const balance = await getTokenBalance(token, owner)
    const amount = balance + 1
    await token.approve(stakingAddress, amount).send()
    return assertRevert(async () => {
      await staking.stake(amount, EMPTY_STRING).send()
    })
  })

  it('stakes for', async () => {
    const initialOwnerBalance = await getTokenBalance(token, owner)
    const initialOtherBalance = await getTokenBalance(token, other)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    // allow Staking app to move owner tokens
    await token.approve(stakingAddress, DEFAULT_AMOUNT).send()
    // stake tokens
    await staking.stakeFor(other, DEFAULT_AMOUNT, EMPTY_STRING).send()

    const finalOwnerBalance = await getTokenBalance(token, owner)
    const finalOtherBalance = await getTokenBalance(token, other)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalOwnerBalance, initialOwnerBalance - DEFAULT_AMOUNT, "owner balance should match")
    assert.equal(finalOtherBalance, initialOtherBalance, "other balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT, "Staking app balance should match")
    assert.equal(fromBn(await staking.totalStakedFor(owner).call()), 0, "staked value for owner should match")
    assert.equal(fromBn(await staking.totalStakedFor(other).call()), DEFAULT_AMOUNT, "staked value for other should match")
  })

  it('unstakes', async () => {
    const initialOwnerBalance = await getTokenBalance(token, owner)
    const initialStakingBalance = await getTokenBalance(token, stakingAddress)

    await approveAndStake()

    // unstake half of them
    await staking.unstake(DEFAULT_AMOUNT / 2, EMPTY_STRING).send()

    const finalOwnerBalance = await getTokenBalance(token, owner)
    const finalStakingBalance = await getTokenBalance(token, stakingAddress)
    assert.equal(finalOwnerBalance, initialOwnerBalance - DEFAULT_AMOUNT / 2, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + DEFAULT_AMOUNT / 2, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner).call()).valueOf(), DEFAULT_AMOUNT / 2, "staked value should match")
  })

  it('fails unstaking 0 amount', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.unstake(0, EMPTY_STRING).send()
    })
  })

  it('fails unstaking more than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.unstake(DEFAULT_AMOUNT + 1, EMPTY_STRING).send()
    })
  })

  context('History', async () => {
    it('supports history', async () => {
      assert.equal(await staking.supportsHistory().call(), true, "It should support History")
    })

    it('has correct "last staked for"', async () => {
      const blockNumber = await staking.getBlockNumber64Ext().call()
      const lastStaked = blockNumber + 5
      await staking.setBlockNumber64(lastStaked).send()
      await approveAndStake()
      assert.equal(await staking.lastStakedFor(owner).call(), lastStaked, "Last staked for should match")
    })

    it('has correct "total staked for at"', async () => {
      const beforeBlockNumber = await staking.getBlockNumber64Ext().call()
      const lastStaked = beforeBlockNumber + 5
      await staking.setBlockNumber64(lastStaked).send()
      await approveAndStake()
      assert.equal(await staking.totalStakedForAt(owner, beforeBlockNumber).call(), 0, "Staked for at before staking should match")
      assert.equal(await staking.totalStakedForAt(owner, lastStaked).call(), DEFAULT_AMOUNT, "Staked for after staking should match")
    })

    it('has correct "total staked at"', async () => {
      const beforeBlockNumber = await staking.getBlockNumber64Ext().call()
      const lastStaked = beforeBlockNumber + 5
      await staking.setBlockNumber64(lastStaked).send()
      await approveAndStake(DEFAULT_AMOUNT, owner)
      await approveAndStake(DEFAULT_AMOUNT, other)
      assert.equal(await staking.totalStakedAt(beforeBlockNumber).call(), 0, "Staked for at before should match")
      assert.equal(await staking.totalStakedAt(lastStaked).call(), DEFAULT_AMOUNT * 2, "Staked for at after staking should match")
    })
  })

  context('Bad Token', async () => {
    let badStaking, badStakingAddress, badToken, badTokenAddress
    beforeEach(async () => {
      const initialAmount = 1000 * DEFAULT_AMOUNT
      const tokenContract = await BadTokenMock.deploy({arguments: [owner, initialAmount]}).send()
      badToken = tokenContract.methods
      badTokenAddress = tokenContract.options.address
      await badToken.mint(other, DEFAULT_AMOUNT).send()
      const stakingContract = await StakingMock.deploy({arguments: [badTokenAddress]}).send()
      badStaking = stakingContract.methods
      badStakingAddress = stakingContract.options.address
    })

    it('fails unstaking because of bad token', async () => {
      // allow Staking app to move owner tokens
      await badToken.approve(badStakingAddress, DEFAULT_AMOUNT).send({ from: owner })
      // stake tokens
      await badStaking.stake(DEFAULT_AMOUNT, EMPTY_STRING).send({ from: owner })

      return assertRevert(async () => {
        // unstake half of them, fails on token transfer
        await badStaking.unstake(DEFAULT_AMOUNT / 2, EMPTY_STRING).send()
      })
    })
  })
})
