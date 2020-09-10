pragma solidity ^0.5.17;


// Interface for ERC900: https://eips.ethereum.org/EIPS/eip-900, optional History methods
interface IERC900History {
    /**
     * @dev Get last time a user modified its staked balance
     * @param _user Account requesting for
     * @return Last block number when account's balance was modified
     */
    function lastStakedFor(address _user) external view returns (uint256);

    /**
     * @dev Get the total amount of tokens staked by a user at a given block number
     * @param _user Account requesting for
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked by the account at the given block number
     */
    function totalStakedForAt(address _user, uint256 _blockNumber) external view returns (uint256);

    /**
     * @dev Get the total amount of tokens staked by all users at a given block number
     * @param _blockNumber Block number at which we are requesting
     * @return The amount of tokens staked at the given block number
     */
    function totalStakedAt(uint256 _blockNumber) external view returns (uint256);
}
