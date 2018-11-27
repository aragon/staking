const { assertRevert } = require('./helpers/assertThrow')
const { getEvent } = require('./helpers/getEvent')

const StakingMock = embark.require('Embark/contracts/StakingMock')
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock')
const BadTokenMock = embark.require('Embark/contracts/BadTokenMock')

let accounts

config({}, (err, accts) => {accounts = accts})

contract('Staking app', () => {
  let staking, token, stakingAddress, tokenAddress, owner, other

  const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  const defaultAmount = 100

  const approveAndStake = async (amount = defaultAmount, from = owner) => {
    // allow Staking app to move owner tokens
    await token.approve(stakingAddress, amount).send({ from: from })
    // stake tokens
    await staking.stake(amount, web3.utils.asciiToHex('')).send({ from: from })
  }

  before(async () => {
    owner = accounts[0]
    other = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = 1000 * defaultAmount
    const tokenContract = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    token = tokenContract.methods
    tokenAddress = tokenContract.options.address
    await token.mint(other, defaultAmount).send()
    const stakingContract = await StakingMock.deploy({arguments: [tokenAddress]}).send()
    staking = stakingContract.methods
    stakingAddress = stakingContract.options.address
  })

  it('has correct initial state', async () => {
    assert.equal(await staking.token().call(), tokenAddress, "Token is wrong")
    assert.equal((await staking.totalStaked().call()).valueOf(), 0, "Initial total staked amount should be zero")
    assert.equal(await staking.supportsHistory().call(), true, "history support should match")
  })

  it('stakes', async () => {
    const initialOwnerBalance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.balanceOf(staking.address).call()).valueOf(), 10)

    await approveAndStake()

    const finalOwnerBalance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.balanceOf(stakingAddress).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - defaultAmount, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + defaultAmount, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner).call()).valueOf(), defaultAmount, "staked value should match")
    // total stake
    assert.equal((await staking.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
  })

  it('fails staking 0 amount', async () => {
    await token.approve(stakingAddress, 1).send()
    return assertRevert(async () => {
      await staking.stake(0, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails staking more than balance', async () => {
    const balance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const amount = balance + 1
    await token.approve(stakingAddress, amount).send()
    return assertRevert(async () => {
      await staking.stake(amount, web3.utils.asciiToHex('')).send()
    })
  })

  it('stakes for', async () => {
    const initialOwnerBalance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const initialOtherBalance = parseInt((await token.balanceOf(other).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.balanceOf(stakingAddress).call()).valueOf(), 10)

    // allow Staking app to move owner tokens
    await token.approve(stakingAddress, defaultAmount).send()
    // stake tokens
    await staking.stakeFor(other, defaultAmount, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const finalOtherBalance = parseInt((await token.balanceOf(other).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.balanceOf(stakingAddress).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - defaultAmount, "owner balance should match")
    assert.equal(finalOtherBalance, initialOtherBalance, "other balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + defaultAmount, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner).call()).valueOf(), 0, "staked value for owner should match")
    assert.equal((await staking.totalStakedFor(other).call()).valueOf(), defaultAmount, "staked value for other should match")
  })

  it('unstakes', async () => {
    const initialOwnerBalance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.balanceOf(stakingAddress).call()).valueOf(), 10)

    await approveAndStake()

    // unstake half of them
    await staking.unstake(defaultAmount / 2, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.balanceOf(owner).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.balanceOf(stakingAddress).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - defaultAmount / 2, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + defaultAmount / 2, "Staking app balance should match")
    assert.equal((await staking.totalStakedFor(owner).call()).valueOf(), defaultAmount / 2, "staked value should match")
  })

  it('fails unstaking 0 amount', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.unstake(0, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails unstaking more than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.unstake(defaultAmount + 1, web3.utils.asciiToHex('')).send()
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
      const blockNumber = await staking.getBlockNumber64Ext().call()
      const lastStaked = blockNumber + 5
      await staking.setBlockNumber64(lastStaked).send()
      await approveAndStake()
      assert.equal(await staking.totalStakedForAt(owner, lastStaked).call(), defaultAmount, "Last staked for should match")
    })

    it('has correct "total staked at"', async () => {
      const blockNumber = await staking.getBlockNumber64Ext().call()
      const lastStaked = blockNumber + 5
      await staking.setBlockNumber64(lastStaked).send()
      await approveAndStake(defaultAmount, owner)
      await approveAndStake(defaultAmount, other)
      assert.equal(await staking.totalStakedAt(lastStaked).call(), defaultAmount * 2, "Last staked for should match")
    })
  })

  context('Bad Token', async () => {
    let badStaking, badStakingAddress, badToken, badTokenAddress
    beforeEach(async () => {
      const initialAmount = 1000 * defaultAmount
      const tokenContract = await BadTokenMock.deploy({arguments: [owner, initialAmount]}).send()
      badToken = tokenContract.methods
      badTokenAddress = tokenContract.options.address
      await badToken.mint(other, defaultAmount).send()
      const stakingContract = await StakingMock.deploy({arguments: [badTokenAddress]}).send()
      badStaking = stakingContract.methods
      badStakingAddress = stakingContract.options.address
    })

    it('fails unstaking because of bad token', async () => {
      // allow Staking app to move owner tokens
      await badToken.approve(badStakingAddress, defaultAmount).send({ from: owner })
      // stake tokens
      await badStaking.stake(defaultAmount, web3.utils.asciiToHex('')).send({ from: owner })

      return assertRevert(async () => {
        // unstake half of them, fails on token transfer
        await badStaking.unstake(defaultAmount / 2, web3.utils.asciiToHex('')).send()
      })
    })
  })
})
