pragma solidity 0.5.3;

import "./os/contracts/lib/math/SafeMath.sol";
import "./os/contracts/lib/token/ERC20.sol";
import "./os/contracts/common/IsContract.sol";
import "./os/contracts/common/Initializable.sol";


contract Staking is Initializable, IsContract {
    ERC20 internal stakingToken;

    function initialize(ERC20 _stakingToken) public onlyInit {
        require(isContract(address(_stakingToken)));
        initialized();
        stakingToken = _stakingToken;
    }

    /**
     * @notice Get the token used by the contract for staking and locking
     * @return The token used by the contract for staking and locking
     */
    function token() external view isInitialized returns (address) {
        return address(stakingToken);
    }
}
