pragma solidity ^0.5.17;

import "./standards/ERC20.sol";

import "./Staking.sol";


contract StakingFactory {
    mapping (address => address) internal instances;

    // Note: we might as well index the token
    event NewStaking(address indexed instance, address token);

    // Note: in terms of code style, should we align all the params to have the _ prefix?
    function existsInstance(ERC20 token) external view returns (bool) {
        return address(getInstance(token)) != address(0);
    }

    function getOrCreateInstance(ERC20 token) external returns (Staking) {
        Staking instance = getInstance(token);
        return address(instance) != address(0) ? instance : _createInstance(token);
    }

    function getInstance(ERC20 token) public view returns (Staking) {
        return Staking(instances[address(token)]);
    }

    function _createInstance(ERC20 token) internal returns (Staking) {
        Staking instance = new Staking(token);
        address tokenAddress = address(token);
        address instanceAddress = address(instance);
        instances[tokenAddress] = instanceAddress;
        emit NewStaking(instanceAddress, tokenAddress);
        return instance;
    }
}
