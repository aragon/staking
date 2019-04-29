pragma solidity 0.4.24;

import "../../Checkpointing.sol";


contract CheckpointingMock {
    using Checkpointing for Checkpointing.History;

    Checkpointing.History history;

    function add(uint256 value, uint256 time) public {
        history.add(value, time);
    }

    function add64(uint64 value, uint256 time) public {
        history.add64(value, time);
    }

    function get(uint256 time) public view returns (uint256) {
        return history.get(time);
    }

    function get64(uint64 time) public view returns (uint256) {
        return history.get64(time);
    }

    function getHistorySize() public view returns (uint256) {
        return history.history.length;
    }

    function lastUpdated() public view returns (uint256) {
        return history.lastUpdated();
    }
}
