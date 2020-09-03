import { ethereum, BigInt, Address } from '@graphprotocol/graph-ts'

import { Stake, User, Lock, StakingPool } from '../types/schema'
import { Staked, Unstaked, LockAmountChanged, LockAllowanceChanged, LockManagerRemoved, LockManagerTransferred, StakeTransferred } from '../types/StakingFactory/StakingPool'

export function handleStaked(event: Staked): void {
  const stake = loadOrCreateStake(event.address, event.params.user)
  stake.amount = stake.amount.plus(event.params.amount)
  stake.available = stake.available.plus(event.params.amount)
  stake.save()

  const pool = StakingPool.load(stake.pool)!
  pool.totalStaked = pool.totalStaked.plus(event.params.amount)
  pool.save()
}

export function handleUnstaked(event: Unstaked): void {
  const stake = loadOrCreateStake(event.address, event.params.user)
  stake.amount = stake.amount.minus(event.params.amount)
  stake.available = stake.available.minus(event.params.amount)
  stake.save()

  const pool = StakingPool.load(stake.pool)!
  pool.totalStaked = pool.totalStaked.minus(event.params.amount)
  pool.save()
}

export function handleLockAmountChanged(event: LockAmountChanged): void {
  const stake = loadOrCreateStake(event.address, event.params.account)
  const lock = loadOrCreateLock(event.address, event.params.account, event.params.lockManager, event)
  const pool = StakingPool.load(stake.pool)!

  if (event.params.increase) {
    stake.locked = stake.locked.plus(event.params.amount)
    stake.available = stake.available.minus(event.params.amount)

    lock.amount = lock.amount.plus(event.params.amount)
    pool.totalLocked = pool.totalLocked.plus(event.params.amount)
  } else {
    stake.locked = stake.locked.minus(event.params.amount)
    stake.available = stake.available.plus(event.params.amount)

    lock.amount = lock.amount.minus(event.params.amount)
    pool.totalLocked = pool.totalLocked.minus(event.params.amount)
  }

  stake.save()
  lock.save()
  pool.save()
}

export function handleLockAllowanceChanged(event: LockAllowanceChanged): void {
  const lock = loadOrCreateLock(event.address, event.params.account, event.params.lockManager, event)

  if (event.params.increase) {
    lock.allowance = lock.allowance.plus(event.params.allowance)
  } else {
    lock.allowance = lock.allowance.minus(event.params.allowance)
  }

  lock.save()
}

export function handleLockManagerRemoved(event: LockManagerRemoved): void {
  const lock = loadOrCreateLock(event.address, event.params.account, event.params.lockManager, event)
  lock.amount = BigInt.fromI32(0)
  lock.allowance = BigInt.fromI32(0)
  lock.save()
}

export function handleLockManagerTransferred(event: LockManagerTransferred): void {
  const lockTo = loadOrCreateLock(event.address, event.params.account, event.params.newLockManager, event)
  const lockFrom = loadOrCreateLock(event.address, event.params.account, event.params.oldLockManager, event)
  lockTo.amount = lockTo.amount.plus(lockFrom.amount)
  lockFrom.amount = lockFrom.amount.minus(lockFrom.amount)
  lockTo.save()
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
  return pool.toHexString() + "user" + user.toHexString()
}

function buildLockId(pool: Address, user: Address, manager: Address): string {
  return buildStakeId(pool, user) + "lock" + manager.toHexString()
}
