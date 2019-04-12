pragma solidity 0.4.24;

import "../../Staking.sol";


contract StakingMock is Staking {
    constructor(ERC20 _stakingToken) Staking(_stakingToken) public {
        // solium-disable-previous-line no-empty-blocks
    }

    uint64 _mockBlockNumber = uint64(block.number);

    function getBlockNumber64Ext() external view returns (uint64) {
        return getBlockNumber64();
    }

    function setBlockNumber64(uint64 i) public {
        _mockBlockNumber = i;
    }

    function getBlockNumber64() internal view returns (uint64) {
        return _mockBlockNumber;
    }
}
