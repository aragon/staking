pragma solidity ^0.4.24;

import "@aragon/os/contracts/common/DelegateProxy.sol";
import "@aragon/os/contracts/common/UnstructuredStorage.sol";


contract ThinProxy is DelegateProxy {
    using UnstructuredStorage for bytes32;

    constructor(address _implementation) public {
        _implementationSlot().setStorageAddress(_implementation);
    }

    function () external {
        delegatedFwd(implementation(), msg.data);
    }

    function proxyType() public pure returns (uint256) {
        return FORWARDING;
    }

    function implementation() public view returns (address) {
        return _implementationSlot().getStorageAddress();
    }

    function _implementationSlot() internal pure returns (bytes32);
}
