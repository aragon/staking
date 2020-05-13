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

    function lockMany(uint256 _number, uint256 _amount, address _lockManager, bytes _data) external {
        Account storage account = accounts[msg.sender];

        uint256 totalAmount = _number.mul(_amount);

        // locking 0 tokens is invalid
        require(totalAmount > 0);

        Lock storage lock_ = account.locks[_lockManager];
        lock_.amount = totalAmount;
        lock_.unlockedAt = MAX_UINT64;
        lock_.data = _data;
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

    function unlockGas(address _account, address _lockManager) external measureGas {
        _unlock(_account, _lockManager);
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
