const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const CheckpointingMock = artifacts.require('CheckpointingMock')

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

  const functionVersions = [
    {
      version: ' uint256',
      getter: 'get',
      setter: 'add'
    },
    {
      version: ' uint64',
      getter: 'get64',
      setter: 'add64'
    }
  ]

  beforeEach(async () => {
    checkpointing = await CheckpointingMock.new()
  })

  context('checkpointing supports:', () => {
    tests.forEach(({ description, values, expects, size }) => {
      functionVersions.forEach(({ version, getter, setter }) => {
        it(description + version, async () => {

          assert.equal(await checkpointing.lastUpdated(), 0, 'last updated should be 0')

          // add values sequentially
          await values.reduce(
            (prev, { v, t }) => prev.then(() => checkpointing[setter](t, v))
            , Promise.resolve())

          await expects.reduce(
            async (prev, { t, v }) =>
              prev.then(
                async () => new Promise(async (resolve, reject) => {
                  assert.equal(await checkpointing[getter](t), v, 'expected value should match checkpoint')
                  resolve()
                })
              )
            , Promise.resolve())

          assert.equal(await checkpointing.getHistorySize(), size, 'size should match')
          assert.equal(await checkpointing.lastUpdated(), values.slice(-1)[0].t, 'last updated should be correct')
        })
      })
    })
  })

  it('fails if inserting past value', async () => {
    const time = 5
    const value = 2

    await checkpointing.add(time, value)

    return assertRevert(async () => {
      await checkpointing.add(time - 1, value)
    })
  })

  const UINT64_OVERFLOW = (new web3.BigNumber(2)).pow(new web3.BigNumber(64))
  const UINT192_OVERFLOW = (new web3.BigNumber(2)).pow(new web3.BigNumber(192))

  it('fails if set value is too high', async () => {
    await checkpointing.add(1, UINT192_OVERFLOW.sub(new web3.BigNumber(1)).toString()) // can set just below limit

    return assertRevert(async () => {
      await checkpointing.add(2, UINT192_OVERFLOW.toString())
    })
  })

  it('fails if set time is too high', async () => {
    await checkpointing.add(UINT64_OVERFLOW.sub(new web3.BigNumber(1)).toString(), 1) // can set just below limit

    return assertRevert(async () => {
      await checkpointing.add(UINT64_OVERFLOW.toString(), 1)
    })
  })

  it('fails if requested time is too high', async () => {
    await checkpointing.add(1, 1)

    assert.equal(await checkpointing.get(UINT64_OVERFLOW.sub(new web3.BigNumber(1)).toString()), 1) // can request just below limit

    return assertRevert(async () => {
      await checkpointing.get(UINT64_OVERFLOW.toString())
    })
  })
})
