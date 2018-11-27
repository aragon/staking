const { assertRevert, assertInvalidOpcode } = require('./helpers/assertThrow')
//const getBalance = require('@aragon/test-helpers/balance')(web3)

const CheckpointingMock = embark.require('Embark/contracts/CheckpointingMock')

let accounts

config({}, (err, accts) => {accounts = accts})

contract('Checkpointing', () => {
  let checkpointing

  const generateRandomTest = size => {
    const rand = () => parseInt(10000 * Math.random())

    let values = []
    let expects = []

    for (let i = 0; i < size; i++) {
      const prev = values[i - 1] || { t: 0, v: 0 }
      const t = 1 + prev.t + rand()
      const v = rand()
      values.push({ t, v })

      expects.push({ t: t - 1, v: prev.v })
      expects.push({ t, v })
    }

    return {
      values,
      expects,
      size,
    }
  }

  const tests = [
    {
      description: 'odd number of checkpoints',
      values: [{ t: 1, v: 2 }, { t: 3, v: 5 }, { t: 5, v: 3 }],
      expects: [{ t: 0, v: 0 }, { t: 1, v: 2 }, { t: 2, v: 2 }, { t: 3, v: 5 }, { t: 4, v: 5 }, { t: 5, v: 3 }, { t: 1000, v: 3 }],
      size: 3
    },
    {
      description: 'even number of checkpoints',
      values: [{ t: 1, v: 2 }, { t: 3, v: 5 }, { t: 5, v: 3 }, { t: 1000, v: 4 }],
      expects: [{ t: 0, v: 0 }, { t: 1, v: 2 }, { t: 2, v: 2 }, { t: 3, v: 5 }, { t: 4, v: 5 }, { t: 5, v: 3 }, { t: 999, v: 3 }, { t: 1000, v: 4 }],
      size: 4
    },
    {
      description: 'change existing checkpoint',
      values: [{ t: 1, v: 2 }, { t: 3, v: 5 }, { t: 3, v: 6}, { t: 5, v: 3 }],
      expects: [{ t: 0, v: 0 }, { t: 1, v: 2 }, { t: 2, v: 2 }, { t: 3, v: 6 }, { t: 4, v: 6 }, { t: 5, v: 3 }, { t: 1000, v: 3 }],
      size: 3
    },
    {
      description: 'random test small',
      ...generateRandomTest(10),
    },
    {
      description: 'random test big',
      ...generateRandomTest(50),
    },
  ]

  beforeEach(async () => {
    checkpointing = await CheckpointingMock.deploy().send()
  })

  context('checkpointing supports:', () => {
    tests.forEach(({ description, values, expects, size }) => {
      it(description, async () => {

        assert.equal(await checkpointing.methods.lastUpdated().call(), 0, 'last updated should be 0')

        // add values sequentially
        await values.reduce(
          (prev, { v, t }) => prev.then(() => checkpointing.methods.add(t, v).send())
        , Promise.resolve())

        await expects.reduce(async (prev, { t, v }) =>
          prev.then(async () =>
            new Promise(async (resolve, reject) => {
              assert.equal(await checkpointing.methods.get(t).call(), v, 'expected value should match checkpoint')
              resolve()
            })
          )
        , Promise.resolve())

        assert.equal(await checkpointing.methods.getHistorySize().call(), size, 'size should match')
        assert.equal(await checkpointing.methods.lastUpdated().call(), values.slice(-1)[0].t, 'last updated should be correct')
      })
    })
  })

  it('fails if inserting past value', async () => {
    const time = 5
    const value = 2

    await checkpointing.methods.add(time, value).send()

    return assertRevert(async () => {
      await checkpointing.methods.add(time - 1, value).send()
    })
  })

  const UINT64_OVERFLOW = (new web3.utils.BN(2)).pow(new web3.utils.BN(64))
  const UINT192_OVERFLOW = (new web3.utils.BN(2)).pow(new web3.utils.BN(192))

  it('fails if set value is too high', async () => {
    await checkpointing.methods.add(1, UINT192_OVERFLOW.sub(new web3.utils.BN(1))).send() // can set just below limit

    return assertRevert(async () => {
      await checkpointing.methods.add(2, UINT192_OVERFLOW).send()
    })
  })

  it('fails if set time is too high', async () => {
    await checkpointing.methods.add(UINT64_OVERFLOW.sub(new web3.utils.BN(1)), 1).send() // can set just below limit

    return assertRevert(async () => {
      await checkpointing.methods.add(UINT64_OVERFLOW, 1).send()
    })
  })

  it('fails if requested time is too high', async () => {
    await checkpointing.methods.add(1, 1).send()

    assert.equal(await checkpointing.methods.get(UINT64_OVERFLOW.sub(new web3.utils.BN(1))).call(), 1) // can request just below limit

    return assertRevert(async () => {
      await checkpointing.methods.get(UINT64_OVERFLOW).call()
    })
  })
})
