pragma solidity 0.5.3;

import "./Staking.sol";
import "./StakingProxy.sol";
import "./os/contracts/lib/token/ERC20.sol";


contract StakingFactory {
    uint256 constant internal SALT = 0;

    string constant private ERROR_ADDRESS_DOES_NOT_MATCH = "SF_INSTANCE_ADDRESS_DOESNT_MATCH";

    Staking public baseImplementation;

    event NewStaking(address indexed instance, address token);

    constructor() public {
        baseImplementation = new Staking();
    }

    function addressFor(ERC20 token) public view returns (address) {
        bytes memory code = _stakingCodeFor(token);
        return _stakingAddressFor(code);
    }

    function instanceFor(ERC20 token) public returns (Staking) {
        bytes memory code = _stakingCodeFor(token);
        address instance = _stakingAddressFor(code);
        if (_existsStakingInstance(instance)) return Staking(instance);

        address newInstance = _deployStakingInstance(code, instance);
        emit NewStaking(instance, address(token));
        return Staking(newInstance);
    }

    function _deployStakingInstance(bytes memory code, address expectedAddress) internal returns (address instance) {
        uint256 salt = SALT;
        assembly { instance := create2(0, add(code, 0x20), mload(code), salt) }
        require(instance == expectedAddress, ERROR_ADDRESS_DOES_NOT_MATCH);
    }

    function _existsStakingInstance(address instanceAddress) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(instanceAddress) }
        return size > 0;
    }

    function _stakingAddressFor(bytes memory code) internal view returns (address addr) {
        bytes32 addressBytes = keccak256(abi.encodePacked(uint8(0xff), address(this), SALT, keccak256(code)));
        assembly { addr := addressBytes }
    }

    function _stakingCodeFor(ERC20 token) internal view returns (bytes memory) {
        bytes memory args = new bytes(64);
        address tokenAddress = address(token);
        address baseImplementationAddress = address(baseImplementation);

        assembly {
            mstore(add(args, 0x20), baseImplementationAddress)
            mstore(add(args, 0x40), tokenAddress)
        }

        return _stakingCodeFor(args);
    }

    function _stakingCodeFor(bytes memory args) internal pure returns (bytes memory) {
        bytes memory constructorCode = type(StakingProxy).creationCode;
        uint256 constructorCodeLength = constructorCode.length;
        uint256 argsLength = args.length;
        bytes memory code = new bytes(constructorCodeLength + argsLength);

        uint256 constructorCodePtr;
        uint256 argsPtr;
        uint256 codePtr;

        assembly {
            constructorCodePtr := add(constructorCode, 0x20)
            argsPtr := add(args, 0x20)
            codePtr := add(code, 0x20)
        }

        memcpy(codePtr, constructorCodePtr, constructorCodeLength);
        memcpy(codePtr + constructorCodeLength, argsPtr, argsLength);
        return code;
    }

    // From: https://github.com/Arachnid/solidity-stringutils/blob/master/src/strings.sol
    function memcpy(uint256 dest, uint256 src, uint256 len) private pure {
        // Copy word-length chunks while possible
        for (; len >= 32; len -= 32) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += 32;
            src += 32;
        }

        // Copy remaining bytes
        uint mask = 256 ** (32 - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }
}
