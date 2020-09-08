pragma solidity 0.5.17;

import "../../lib/Checkpointing.sol";


contract CheckpointingMock {
    using Checkpointing for Checkpointing.History;

    Checkpointing.History history;

    function addCheckpoint(uint64 value, uint256 time) public {
        history.addCheckpoint(value, time);
    }

    function latestValue() public view returns (uint256) {
        return history.latestValue();
    }

    function getValueAt(uint64 time) public view returns (uint256) {
        return history.getValueAt(time);
    }

    function getHistorySize() public view returns (uint256) {
        return history.history.length;
    }

    function lastUpdated() public view returns (uint256) {
        return history.lastUpdated();
    }
}
