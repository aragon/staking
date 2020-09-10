pragma solidity ^0.5.17;


// Interface for ERC900: https://eips.ethereum.org/EIPS/eip-900
interface IERC900 {
    event Staked(address indexed user, uint256 amount, uint256 total, bytes data);
    event Unstaked(address indexed user, uint256 amount, uint256 total, bytes data);

    /**
     * @dev Stake a certain amount of tokens
     * @param _amount Amount of tokens to be staked
     * @param _data Optional data that can be used to add signalling information in more complex staking applications
     */
    function stake(uint256 _amount, bytes calldata _data) external;

    /**
     * @dev Stake a certain amount of tokens to another address
     * @param _user Address to stake tokens to
     * @param _amount Amount of tokens to be staked
     * @param _data Optional data that can be used to add signalling information in more complex staking applications
     */
    function stakeFor(address _user, uint256 _amount, bytes calldata _data) external;

    /**
     * @dev Unstake a certain amount of tokens
     * @param _amount Amount of tokens to be unstaked
     * @param _data Optional data that can be used to add signalling information in more complex staking applications
     */
    function unstake(uint256 _amount, bytes calldata _data) external;

    /**
     * @dev Tell the current total amount of tokens staked for an address
     * @param _addr Address to query
     * @return Current total amount of tokens staked for the address
     */
    function totalStakedFor(address _addr) external view returns (uint256);

    /**
     * @dev Tell the current total amount of tokens staked from all addresses
     * @return Current total amount of tokens staked from all addresses
     */
    function totalStaked() external view returns (uint256);

    /**
     * @dev Tell the address of the staking token
     * @return Address of the staking token
     */
    function token() external view returns (address);

    /*
     * @dev Tell if the optional history functions are implemented
     * @return True if the optional history functions are implemented
     */
    function supportsHistory() external pure returns (bool);
}
