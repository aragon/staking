pragma solidity 0.5.17;

import "../../Staking.sol";
import "./TimeHelpersMock.sol";


contract StakingMock is Staking, TimeHelpersMock {
    constructor(ERC20 _stakingToken) Staking(_stakingToken) public {}

    function setBlockNumber(uint64 _mockedBlockNumber) public {
        mockedBlockNumber = _mockedBlockNumber;
    }
}
