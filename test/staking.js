const { assertRevert } = require('./helpers/assertThrow')

const StakingMock = embark.require('Embark/contracts/StakingMock')
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock')

const getEvent = (receipt, event, arg) => { return receipt.events.filter(l => l.event == event)[0].args[arg] }

let accounts

config({}, (err, accts) => {
  accounts = accts
})

contract('Staking app', () => {
  let staking, token, owner, other

  const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  const defaultAmount = 100

  const approveAndStake = async (amount = defaultAmount, from = owner) => {
    // allow Staking app to move owner tokens
    await token.methods.approve(staking.options.address, amount).send({ from: from })
    // stake tokens
    await staking.methods.stake(amount, web3.utils.asciiToHex('')).send({ from: from })
  }

  before(async () => {
    owner = accounts[0]
    other = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = web3.utils.toWei('1000', 'ether')
    token = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    await token.methods.mint(other, defaultAmount).send()
    staking = await StakingMock.deploy({arguments: [token.options.address]}).send()
  })

  it('has correct initial state', async () => {
    assert.equal(await staking.methods.token().call(), token.options.address, "Token is wrong")
    assert.equal((await staking.methods.totalStaked().call()).valueOf(), 0, "Initial total staked amount should be zero")
    assert.equal(await staking.methods.supportsHistory().call(), true, "history support should match")
  })

  it('stakes', async () => {
    const initialOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.methods.balanceOf(staking.address).call()).valueOf(), 10)

    await approveAndStake()

    const finalOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - defaultAmount, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + defaultAmount, "Staking app balance should match")
    assert.equal((await staking.methods.totalStakedFor(owner).call()).valueOf(), defaultAmount, "staked value should match")
    // total stake
    assert.equal((await staking.methods.totalStaked().call()).toString(), defaultAmount, "Total stake should match")
  })

  it('fails staking 0 amount', async () => {
    await token.methods.approve(staking.options.address, 1).send()
    return assertRevert(async () => {
      await staking.methods.stake(0, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails staking more than balance', async () => {
    const balance = await token.methods.balanceOf(owner).call()
    const amount = balance + 1
    await token.methods.approve(staking.options.address, amount).send()
    return assertRevert(async () => {
      await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
    })
  })

  it('stakes for', async () => {
    const initialOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const initialOtherBalance = parseInt((await token.methods.balanceOf(other).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)

    // allow Staking app to move owner tokens
    await token.methods.approve(staking.options.address, defaultAmount).send()
    // stake tokens
    await staking.methods.stakeFor(other, defaultAmount, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const finalOtherBalance = parseInt((await token.methods.balanceOf(other).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - defaultAmount, "owner balance should match")
    assert.equal(finalOtherBalance, initialOtherBalance, "other balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + defaultAmount, "Staking app balance should match")
    assert.equal((await staking.methods.totalStakedFor(owner).call()).valueOf(), 0, "staked value for owner should match")
    assert.equal((await staking.methods.totalStakedFor(other).call()).valueOf(), defaultAmount, "staked value for other should match")
  })

  it('unstakes', async () => {
    const initialOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)

    await approveAndStake()

    // unstake half of them
    await staking.methods.unstake(defaultAmount / 2, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - defaultAmount / 2, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + defaultAmount / 2, "Staking app balance should match")
    assert.equal((await staking.methods.totalStakedFor(owner).call()).valueOf(), defaultAmount / 2, "staked value should match")
  })

  it('fails unstaking 0 amount', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.methods.unstake(0, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails unstaking more than staked', async () => {
    await approveAndStake()
    return assertRevert(async () => {
      await staking.methods.unstake(defaultAmount + 1, web3.utils.asciiToHex('')).send()
    })
  })

  context('History', async () => {
    it('supports history', async () => {
      assert.equal(await staking.methods.supportsHistory().call(), true, "It should support History")
    })

    it('has correct "last staked for"', async () => {
      const blockNumber = await staking.methods.getBlockNumber64Ext().call()
      const lastStaked = blockNumber + 5
      await staking.methods.setBlockNumber64(lastStaked).send()
      await approveAndStake()
      assert.equal(await staking.methods.lastStakedFor(owner).call(), lastStaked, "Last staked for should match")
    })

    it('has correct "total staked for at"', async () => {
      const blockNumber = await staking.methods.getBlockNumber64Ext().call()
      const lastStaked = blockNumber + 5
      await staking.methods.setBlockNumber64(lastStaked).send()
      await approveAndStake()
      assert.equal(await staking.methods.totalStakedForAt(owner, lastStaked).call(), defaultAmount, "Last staked for should match")
    })

    it('has correct "total staked at"', async () => {
      const blockNumber = await staking.methods.getBlockNumber64Ext().call()
      const lastStaked = blockNumber + 5
      await staking.methods.setBlockNumber64(lastStaked).send()
      await approveAndStake(defaultAmount, owner)
      await approveAndStake(defaultAmount, other)
      assert.equal(await staking.methods.totalStakedAt(lastStaked).call(), defaultAmount * 2, "Last staked for should match")
    })
  })
})
