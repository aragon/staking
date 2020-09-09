// Adapted from: https://github.com/Dexaran/ERC223-token-standard/blob/development/token/ERC223/ERC223.sol

pragma solidity ^0.5.1;


import "../../standards/IERC223Recipient.sol";
import "../../lib/os/SafeMath.sol";
import "../../lib/os/IsContract.sol";

/**
 * @title Implementation of the ERC223 standard token.
 */
contract ERC223TokenMock is IsContract {
    using SafeMath for uint;

    uint public totalSupply;

    event Transfer(address indexed from, address indexed to, uint value, bytes data);

    mapping(address => uint) balances; // List of user balances.

    function generateTokens(address _owner, uint _amount) external returns (bool) {
        uint previousBalanceTo = balanceOf(_owner);
        totalSupply = totalSupply.add(_amount);
        balances[_owner] = previousBalanceTo.add(_amount);
        emit Transfer(address(0), _owner, _amount, new bytes(0));
        return true;
    }

    /**
     * @dev Transfer the specified amount of tokens to the specified address.
     *      Invokes the `tokenFallback` function if the recipient is a contract.
     *      The token transfer fails if the recipient is a contract
     *      but does not implement the `tokenFallback` function
     *      or the fallback function to receive funds.
     *
     * @param _to    Receiver address.
     * @param _value Amount of tokens that will be transferred.
     * @param _data  Transaction metadata.
     */
    function transfer(address _to, uint _value, bytes memory _data) public returns (bool success){
        // Standard function transfer similar to ERC20 transfer with no _data .
        // Added due to backwards compatibility reasons .
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        if(isContract(_to)) {
            IERC223Recipient receiver = IERC223Recipient(_to);
            receiver.tokenFallback(msg.sender, _value, _data);
        }
        emit Transfer(msg.sender, _to, _value, _data);
        return true;
    }

    /**
     * @dev Transfer the specified amount of tokens to the specified address.
     *      This function works the same with the previous one
     *      but doesn't contain `_data` param.
     *      Added due to backwards compatibility reasons.
     *
     * @param _to    Receiver address.
     * @param _value Amount of tokens that will be transferred.
     */
    /*
    function transfer(address _to, uint _value) public returns (bool success){
        bytes memory empty = hex"00000000";
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        if(isContract(_to)) {
            IERC223Recipient receiver = IERC223Recipient(_to);
            receiver.tokenFallback(msg.sender, _value, empty);
        }
        emit Transfer(msg.sender, _to, _value, empty);
        return true;
    }
    */


    /**
     * @dev Returns balance of the `_owner`.
     *
     * @param _owner   The address whose balance will be returned.
     * @return balance Balance of the `_owner`.
     */
    function balanceOf(address _owner) public view returns (uint balance) {
        return balances[_owner];
    }
}
