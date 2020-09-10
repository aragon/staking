const { assertRevert } = require('@aragon/contract-helpers-test/assertThrow')
const { bn, assertBn, MAX_UINT256 } = require('@aragon/contract-helpers-test/numbers')
const { CHECKPOINT_ERRORS } = require('../helpers/errors')

const Checkpointing = artifacts.require('CheckpointingMock')

contract('Checkpointing', () => {
  let checkpointing

  beforeEach('create tree', async () => {
    checkpointing = await Checkpointing.new()
  })

  const assertFetchedValue = async (time, expectedValue) => {
    assertBn((await checkpointing.get(time)), expectedValue, 'value does not match')
  }

  describe('add', () => {
    context('when the given value is can be represented by 192 bits', () => {
      const value = bn(100)

      context('when there was no value registered yet', async () => {
        context('when the given time is zero', async () => {
          const time = bn(0)

          it('adds the new value', async () => {
            await checkpointing.add(time, value)

            await assertFetchedValue(time, value)
          })
        })

        context('when the given time is greater than zero', async () => {
          const time= bn(1)

          it('adds the new value', async () => {
            await checkpointing.add(time, value)

            await assertFetchedValue(time, value)
          })
        })
      })

      context('when there were some values already registered', async () => {
        beforeEach('add some values', async () => {
          await checkpointing.add(30, 1)
          await checkpointing.add(50, 2)
          await checkpointing.add(90, 3)
        })

        context('when the given time is previous to the latest registered value', async () => {
          const time= bn(40)

          it('reverts', async () => {
            await assertRevert(checkpointing.add(time, value), CHECKPOINT_ERRORS.CANNOT_ADD_PAST_VALUE)
          })
        })

        context('when the given time is equal to the latest registered value', async () => {
          const time= bn(90)

          it('updates the already registered value', async () => {
            await checkpointing.add(time, value)

            await assertFetchedValue(time, value)
            await assertFetchedValue(time.add(bn(1)), value)
          })
        })

        context('when the given time is after the latest registered value', async () => {
          const time= bn(95)

          it('adds the new last value', async () => {
            const previousLast = await checkpointing.getLast()

            await checkpointing.add(time, value)

            await assertFetchedValue(time, value)
            await assertFetchedValue(time.add(bn(1)), value)
            await assertFetchedValue(time.sub(bn(1)), previousLast)
          })
        })
      })
    })

    context('when the given value cannot be represented by 192 bits', () => {
      const value = MAX_UINT256

      it('reverts', async () => {
        await assertRevert(checkpointing.add(0, value), CHECKPOINT_ERRORS.VALUE_TOO_BIG)
      })
    })
  })

  describe('lastUpdate', () => {
    context('when there are no values registered yet', () => {
      it('returns zero', async () => {
        assertBn((await checkpointing.lastUpdate()), bn(0), 'time does not match')
      })
    })

    context('when there are values already registered', () => {
      beforeEach('add some values', async () => {
        await checkpointing.add(30, 1)
        await checkpointing.add(50, 2)
        await checkpointing.add(90, 3)
      })

      it('returns the last registered value', async () => {
        assertBn((await checkpointing.lastUpdate()), bn(90), 'time does not match')
      })
    })
  })

  describe('getLast', () => {
    context('when there are no values registered yet', () => {
      it('returns zero', async () => {
        assertBn((await checkpointing.getLast()), bn(0), 'value does not match')
      })
    })

    context('when there are values already registered', () => {
      beforeEach('add some values', async () => {
        await checkpointing.add(30, 1)
        await checkpointing.add(50, 2)
        await checkpointing.add(90, 3)
      })

      it('returns the last registered value', async () => {
        assertBn((await checkpointing.getLast()), bn(3), 'value does not match')
      })
    })
  })

  describe('get', () => {
    context('when there are no values registered yet', () => {
      context('when there given time is zero', () => {
        const time= bn(0)

        it('returns zero', async () => {
          await assertFetchedValue(time, bn(0))
        })
      })

      context('when there given time is greater than zero', () => {
        const time= bn(1)

        it('returns zero', async () => {
          await assertFetchedValue(time, bn(0))
        })
      })
    })

    context('when there are values already registered', () => {
      beforeEach('add some values', async () => {
        await checkpointing.add(30, 1)
        await checkpointing.add(50, 2)
        await checkpointing.add(90, 3)
      })

      context('when there given time is zero', () => {
        const time= bn(0)

        it('returns zero', async () => {
          await assertFetchedValue(time, bn(0))
        })
      })

      context('when the given time is previous to the time of first registered value', () => {
        const time= bn(10)

        it('returns zero', async () => {
          await assertFetchedValue(time, bn(0))
        })
      })

      context('when the given time is equal to the time of first registered value', () => {
        const time= bn(30)

        it('returns the first registered value', async () => {
          await assertFetchedValue(time, bn(1))
        })
      })

      context('when the given time is between the times of first and the second registered values', () => {
        const time= bn(40)

        it('returns the first registered value', async () => {
          await assertFetchedValue(time, bn(1))
        })
      })

      context('when the given time is the time of the second registered values', () => {
        const time= bn(50)

        it('returns the second registered value', async () => {
          await assertFetchedValue(time, bn(2))
        })
      })

      context('when the given time is between the times of second and the third registered values', () => {
        const time= bn(60)

        it('returns the second registered value', async () => {
          await assertFetchedValue(time, bn(2))
        })
      })

      context('when the given time is equal to the time of the third registered values', () => {
        const time= bn(90)

        it('returns the third registered value', async () => {
          await assertFetchedValue(time, bn(3))
        })
      })

      context('when the given time is after the time of the third registered values', () => {
        const time= bn(100)

        it('returns the third registered value', async () => {
          await assertFetchedValue(time, bn(3))
        })
      })
    })
  })

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

  describe('checkpointing supports:', () => {
    tests.forEach(({ description, values, expects, size }) => {
      it(description, async () => {
        assert.equal(await checkpointing.lastUpdate(), 0, 'last updated should be 0')

        // add values sequentially
        await values.reduce(
          (prev, { v, t }) => prev.then(() => checkpointing.add(t, v)),
          Promise.resolve()
        )

        await expects.reduce(
          async (prev, { t, v }) =>
            prev.then(async () => {
              assert.equal((await checkpointing.get(t)).toString(), v, 'expected value should match checkpoint')
            }),
          Promise.resolve()
        )

        assert.equal(await checkpointing.getHistorySize(), size, 'size should match')
        assert.equal(await checkpointing.lastUpdate(), values.slice(-1)[0].t, 'last updated should be correct')
      })
    })
  })

  it('fails if inserting value at past time', async () => {
    const time = 5
    const value = 2

    await checkpointing.add(time, value)

    await assertRevert(checkpointing.add(time - 1, value))
  })
})
