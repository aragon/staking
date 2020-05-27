pragma solidity 0.4.24;

import "../../Staking.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/test-helpers/contracts/TimeHelpersMock.sol";


contract StakingMock is Staking, TimeHelpersMock {
    using SafeMath for uint256;

    event LogGas(uint256 gas);

    uint64 private constant MAX_UINT64 = uint64(-1);

    modifier measureGas {
        uint256 initialGas = gasleft();
        _;
        emit LogGas(initialGas - gasleft());
    }

    constructor(ERC20 _stakingToken) public {
        require(isContract(_stakingToken));
        initialized();
        stakingToken = _stakingToken;
    }

    function unlockedBalanceOfGas() external returns (uint256) {
        uint256 initialGas = gasleft();
        _unlockedBalanceOf(msg.sender);
        uint256 gasConsumed = initialGas - gasleft();
        emit LogGas(gasConsumed);
        return gasConsumed;
    }

    function transferGas(address _to, address _toLockManager, uint256 _amount) external measureGas {
        // have enough unlocked funds
        require(_amount <= _unlockedBalanceOf(msg.sender));

        _transfer(msg.sender, address(0), _to, _toLockManager, _amount);
    }

    function setBlockNumber(uint64 _mockedBlockNumber) public {
        mockedBlockNumber = _mockedBlockNumber;
    }

    // Override petrify functions to allow mocking the initialization process
    function petrify() internal onlyInit {
        // solium-disable-previous-line no-empty-blocks
        // initializedAt(PETRIFIED_BLOCK);
    }
}
