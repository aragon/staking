import { ethereum, BigInt, Address } from '@graphprotocol/graph-ts'

import { Stake, User, Lock, StakingPool, Movement } from '../types/schema'
import { Staked, Unstaked, LockAmountChanged, LockAllowanceChanged, LockManagerRemoved, StakeTransferred } from '../types/StakingFactory/StakingPool'

export function handleStaked(event: Staked): void {
  const stake = loadOrCreateStake(event.address, event.params.user)
  stake.amount = stake.amount.plus(event.params.amount)
  stake.available = stake.available.plus(event.params.amount)
  stake.save()

  const pool = StakingPool.load(stake.pool)!
  pool.totalStaked = pool.totalStaked.plus(event.params.amount)
  pool.save()

  createMovement(event.address, event.params.user, event.params.amount, 'Staked', event)
}

export function handleUnstaked(event: Unstaked): void {
  const stake = loadOrCreateStake(event.address, event.params.user)
  stake.amount = stake.amount.minus(event.params.amount)
  stake.available = stake.available.minus(event.params.amount)
  stake.save()

  const pool = StakingPool.load(stake.pool)!
  pool.totalStaked = pool.totalStaked.minus(event.params.amount)
  pool.save()

  createMovement(event.address, event.params.user, event.params.amount, 'Unstaked', event)
}

export function handleLockAmountChanged(event: LockAmountChanged): void {
  const stake = loadOrCreateStake(event.address, event.params.user)
  const lock = loadOrCreateLock(event.address, event.params.user, event.params.lockManager, event)
  const pool = StakingPool.load(stake.pool)!

  const newLockedAmount = event.params.amount
  const increase = newLockedAmount.gt(lock.amount)
  const diff = increase ? newLockedAmount.minus(lock.amount) : lock.amount.minus(newLockedAmount)
  lock.amount = newLockedAmount

  if (increase) {
    stake.locked = stake.locked.plus(diff)
    stake.available = stake.available.minus(diff)
    pool.totalLocked = pool.totalLocked.plus(diff)
    createMovement(event.address, event.params.user, diff, 'Locked', event)
  } else {
    stake.locked = stake.locked.minus(diff)
    stake.available = stake.available.plus(diff)
    pool.totalLocked = pool.totalLocked.minus(diff)
    createMovement(event.address, event.params.user, diff, 'Unlocked', event)
  }

  stake.save()
  lock.save()
  pool.save()
}

export function handleLockAllowanceChanged(event: LockAllowanceChanged): void {
  const lock = loadOrCreateLock(event.address, event.params.user, event.params.lockManager, event)
  lock.allowance = event.params.allowance
  lock.save()
}

export function handleLockManagerRemoved(event: LockManagerRemoved): void {
  const lock = loadOrCreateLock(event.address, event.params.user, event.params.lockManager, event)
  lock.amount = BigInt.fromI32(0)
  lock.allowance = BigInt.fromI32(0)
  lock.save()
}

export function handleStakeTransferred(event: StakeTransferred): void {
  const stakeFrom = loadOrCreateStake(event.address, event.params.from)
  stakeFrom.amount = stakeFrom.amount.minus(event.params.amount)
  stakeFrom.available = stakeFrom.available.minus(event.params.amount)
  stakeFrom.save()

  const stakeTo = loadOrCreateStake(event.address, event.params.to)
  stakeTo.amount = stakeTo.amount.plus(event.params.amount)
  stakeTo.available = stakeTo.available.plus(event.params.amount)
  stakeTo.save()

  createMovement(event.address, event.params.from, event.params.amount, 'Unstake', event)
  createMovement(event.address, event.params.to, event.params.amount, 'Stake', event)
}

function createMovement(pool: Address, user: Address, amount: BigInt, type: string, event: ethereum.Event): void {
  const stakeId = buildStakeId(pool, user)
  const movementId = stakeId + "-" + event.transaction.hash.toHexString() + event.logIndex.toString()
  const movement = new Movement(movementId)
  movement.type = type
  movement.stake = stakeId
  movement.amount = amount
  movement.createdAt = event.block.timestamp
  movement.save()
}

function loadOrCreateStake(pool: Address, user: Address): Stake {
  const id = buildStakeId(pool, user)
  let stake = Stake.load(id)

  if (stake === null) {
    stake = new Stake(id)
    stake.user = loadOrCreateUser(user).id
    stake.pool = pool.toHexString()
    stake.amount = BigInt.fromI32(0)
    stake.locked = BigInt.fromI32(0)
    stake.available = BigInt.fromI32(0)
  }

  return stake!
}

function loadOrCreateUser(userAddress: Address): User {
  let id = userAddress.toHexString()
  let user = User.load(id)

  if (user === null) {
    user = new User(id)
    user.save()
  }

  return user!
}

function loadOrCreateLock(pool: Address, user: Address, manager: Address, event: ethereum.Event): Lock {
  let id = buildLockId(pool, user, manager)
  let lock = Lock.load(id)

  if (lock === null) {
    lock = new Lock(id)
    lock.stake = buildStakeId(pool, user)
    lock.manager = manager
    lock.amount = BigInt.fromI32(0)
    lock.allowance = BigInt.fromI32(0)
    lock.createdAt = event.block.timestamp
    lock.save()
  }

  return lock!
}

function buildStakeId(pool: Address, user: Address): string {
  return pool.toHexString() + "-user-" + user.toHexString()
}

function buildLockId(pool: Address, user: Address, manager: Address): string {
  return buildStakeId(pool, user) + "-lock-" + manager.toHexString()
}
