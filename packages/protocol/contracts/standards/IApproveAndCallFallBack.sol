// See MiniMe token (https://github.com/Giveth/minime/blob/master/contracts/MiniMeToken.sol)

pragma solidity ^0.5.17;


interface IApproveAndCallFallBack {
    function receiveApproval(
        address from,
        uint256 _amount,
        address _token,
        bytes calldata _data
    ) external;
}
