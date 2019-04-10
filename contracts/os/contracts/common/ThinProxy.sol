pragma solidity 0.5.3;

import "./DelegateProxy.sol";


contract ThinProxy is DelegateProxy {
    constructor(address _implementation) public {
        bytes32 slot = _implementationSlot();
        assembly { sstore(slot, _implementation) }
    }

    function () external {
        delegatedFwd(implementation(), msg.data);
    }

    function proxyType() public pure returns (uint256) {
        return FORWARDING;
    }

    function implementation() public view returns (address _implementation) {
        bytes32 slot = _implementationSlot();
        assembly { _implementation := sload(slot) }
    }

    function _implementationSlot() internal pure returns (bytes32);
}
