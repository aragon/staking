pragma solidity 0.4.24;

import "../../Staking.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";


contract StakingMock is Staking {
    using SafeMath for uint256;

    uint64 private constant MAX_UINT64 = uint64(-1);

    constructor(ERC20 _stakingToken) Staking(_stakingToken) public {
        // solium-disable-previous-line no-empty-blocks
    }

    uint64 _mockBlockNumber = uint64(block.number);

    event LogGas(uint256 gas);

    modifier measureGas {
        uint256 initialGas = gasleft();
        _;
        emit LogGas(initialGas - gasleft());
    }

    function lockMany(uint256 _number, uint256 _amount, address _manager, bytes _data) external {
        Account storage account = accounts[msg.sender];

        uint256 totalAmount = _number.mul(_amount);

        // locking 0 tokens is invalid
        require(totalAmount > 0);

        // check not too many locks
        require(account.activeLockIds.length + _number <= MAX_LOCKS);

        for (uint256 i = 0; i < _number; i++) {

            // first valid lock starts at 1, so _toLockId = 0 means no lock
            account.lastLockId++;
            uint256 _lockId = account.lastLockId;
            account.activeLockIds.push(_lockId);
            Lock storage lock_ = account.locks[_lockId];
            lock_.amount = _amount;
            lock_.unlockedAt = MAX_UINT64;
            lock_.manager = ILockManager(_manager);
            lock_.data = _data;
        }
    }

    function unlockedBalanceOfGas() external returns (uint256) {
        uint256 initialGas = gasleft();
        unlockedBalanceOf(msg.sender);
        uint256 gasConsumed = initialGas - gasleft();
        emit LogGas(gasConsumed);
        return gasConsumed;
    }

    /*
    function lockGas(uint256 _amount, address _manager, bytes _data) external measureGas returns (uint256) {
        return lock(_amount, _manager, _data);
    }
    */

    function transferGas(address _to, uint256 _toLockId, uint256 _amount) external measureGas {
        // have enough unlocked funds
        require(_amount <= unlockedBalanceOf(msg.sender));

        _transfer(msg.sender, 0, _to, _toLockId, _amount);
    }

    function unlockGas(address _account, uint256 _lockId) external measureGas {
        unlock(_account, _lockId);
    }

    function getBlockNumber64Ext() external view returns (uint64) {
        return getBlockNumber64();
    }

    function getMaxLocks() public pure returns (uint256) {
        return MAX_LOCKS;
    }

    function setBlockNumber64(uint64 i) public {
        _mockBlockNumber = i;
    }

    function getBlockNumber64() internal view returns (uint64) {
        return _mockBlockNumber;
    }
}
