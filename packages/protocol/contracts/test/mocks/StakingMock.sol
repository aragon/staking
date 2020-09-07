pragma solidity 0.5.17;

import "../../Staking.sol";
import "./TimeHelpersMock.sol";


contract StakingMock is Staking, TimeHelpersMock {
    string private constant ERROR_TOKEN_NOT_CONTRACT = "STAKING_TOKEN_NOT_CONTRACT";

    constructor(ERC20 _stakingToken) public {
        require(isContract(address(_stakingToken)), ERROR_TOKEN_NOT_CONTRACT);
        initialized();
        stakingToken = _stakingToken;
    }

    function setBlockNumber(uint64 _mockedBlockNumber) public {
        mockedBlockNumber = _mockedBlockNumber;
    }

    // Override petrify functions to allow mocking the initialization process
    function petrify() internal onlyInit {
        // solium-disable-previous-line no-empty-blocks
        // initializedAt(PETRIFIED_BLOCK);
    }
}
