import { BigInt, Address } from '@graphprotocol/graph-ts'

import { NewStaking } from '../types/StakingFactory/StakingFactory'
import { ERC20, StakingPool } from '../types/schema'
import { ERC20 as ERC20Contract } from '../types/StakingFactory/ERC20'
import { StakingPool as StakingPoolTemplate } from '../types/templates'

export function handleNewStaking(event: NewStaking): void {
  const pool = new StakingPool(event.params.instance.toHexString())
  pool.createdAt = event.block.timestamp
  pool.totalStaked = BigInt.fromI32(0)
  pool.totalLocked = BigInt.fromI32(0)
  pool.token = createERC20(event.params.token)
  pool.save()

  StakingPoolTemplate.create(event.params.instance)
}

function createERC20(address: Address): string {
  const token = new ERC20(address.toHexString())
  const tokenContract = ERC20Contract.bind(address)

  token.name = tokenContract.name()
  token.symbol = tokenContract.symbol()
  token.decimals = tokenContract.decimals()
  token.save()
  return token.id
}
