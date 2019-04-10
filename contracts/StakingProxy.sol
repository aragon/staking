pragma solidity 0.5.3;

import "./Staking.sol";
import "./os/contracts/common/ThinProxy.sol";
import "./os/contracts/lib/token/ERC20.sol";


contract StakingProxy is ThinProxy {
    // keccak256("aragon.network.staking")
    bytes32 internal constant IMPLEMENTATION_SLOT = 0xbd536e2e005accda865e2f0d1827f83ec8824f3ea04ecd6131b7c10058635814;

    string internal constant ERROR_INITIALIZATION_FAILED = "STAKING_PROXY_INIT_FAILED";
    string internal constant ERROR_WRONG_IMPLEMENTATION_SLOT = "STAKING_PROXY_WRONG_IMPL_SLOT";

    constructor(address _implementation, ERC20 _token) ThinProxy(_implementation) public {
        require(IMPLEMENTATION_SLOT == keccak256("aragon.network.staking"), ERROR_WRONG_IMPLEMENTATION_SLOT);

        bytes4 selector = Staking(_implementation).initialize.selector;
        bytes memory initializeCalldata = abi.encodeWithSelector(selector, _token);
        (bool result, bytes memory returndata) = _implementation.delegatecall(initializeCalldata);
        require(result, string(returndata));
    }

    function _implementationSlot() internal pure returns (bytes32) {
        return IMPLEMENTATION_SLOT;
    }
}
