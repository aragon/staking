pragma solidity ^0.5.17;


// Interface for ERC900: https://eips.ethereum.org/EIPS/eip-900, optional History methods
interface IERC900History {
    /**
     * @dev Tell last time a user modified their staked balance
     * @param _user Address to query
     * @return Last block number when address's balance was modified
     */
    function lastStakedFor(address _user) external view returns (uint256);

    /**
     * @dev Tell the total amount of tokens staked for an address at a given block number
     * @param _user Address to query
     * @param _blockNumber Block number
     * @return Total amount of tokens staked for the address at the given block number
     */
    function totalStakedForAt(address _user, uint256 _blockNumber) external view returns (uint256);

    /**
     * @dev Tell the total amount of tokens staked from all addresses at a given block number
     * @param _blockNumber Block number
     * @return Total amount of tokens staked from all addresses at the given block number
     */
    function totalStakedAt(uint256 _blockNumber) external view returns (uint256);
}
