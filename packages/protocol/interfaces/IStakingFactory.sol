pragma solidity >=0.4 <=0.7;

import "./IStaking.sol";


interface IStakingFactory {
    function getOrCreateInstance(/* ERC20 */ address token) external returns (IStaking);

    function existsInstance(/* ERC20 */ address token) external view returns (bool);
    function getInstance(/* ERC20 */ address token) external view returns (IStaking);
}
