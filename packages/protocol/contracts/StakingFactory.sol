pragma solidity ^0.5.17;

import "./standards/IERC20.sol";

import "./Staking.sol";


contract StakingFactory {
    mapping (address => address) internal instances;

    event NewStaking(address indexed instance, address indexed token);

    function existsInstance(IERC20 _token) external view returns (bool) {
        return address(getInstance(_token)) != address(0);
    }

    function getOrCreateInstance(IERC20 _token) external returns (Staking) {
        Staking instance = getInstance(_token);
        return address(instance) != address(0) ? instance : _createInstance(_token);
    }

    function getInstance(IERC20 _token) public view returns (Staking) {
        return Staking(instances[address(_token)]);
    }

    function _createInstance(IERC20 _token) internal returns (Staking) {
        Staking instance = new Staking(_token);
        address tokenAddress = address(_token);
        address instanceAddress = address(instance);
        instances[tokenAddress] = instanceAddress;
        emit NewStaking(instanceAddress, tokenAddress);
        return instance;
    }
}
