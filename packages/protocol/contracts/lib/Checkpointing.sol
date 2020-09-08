pragma solidity ^0.5.17;


/**
 * @title Checkpointing
 * @notice Checkpointing library for keeping track of historical values based on an arbitrary time
 *         unit (e.g. seconds or block numbers).
 * @dev Inspired by:
 *   - MiniMe token (https://github.com/aragon/minime/blob/master/contracts/MiniMeToken.sol)
 */
library Checkpointing {
    uint256 private constant MAX_UINT192 = uint256(uint192(-1));

    string private constant ERROR_VALUE_TOO_BIG = "CHECKPOINT_VALUE_TOO_BIG";
    string private constant ERROR_PAST_CHECKPOINT = "CHECKPOINT_PAST_CHECKPOINT";

    /**
     * @dev To specify a value at a given point in time, we need to store two values:
     *      - `time`: unit-time value to denote the first time when a value was registered
     *      - `value`: a positive numeric value to registered at a given point in time
     *
     *      Note that `time` does not need to refer necessarily to a timestamp value, any time unit could be used
     *      for it like block numbers, terms, etc.
     */
    struct Checkpoint {
        uint64 time;
        uint192 value;
    }

    /**
     * @dev A history simply denotes a list of checkpoints
     */
    struct History {
        Checkpoint[] history;
    }

    /**
     * @dev Add a new value to a history for a given point in time. This function does not allow to add values previous
     *      to the latest registered value, if the value willing to add corresponds to the latest registered value, it
     *      will be updated.
     * @param self Checkpoints history to be altered
     * @param _time Point in time to register the given value
     * @param _value Numeric value to be registered at the given point in time
     */
    function addCheckpoint(History storage self, uint64 _time, uint256 _value) internal {
        require(_value <= MAX_UINT192, ERROR_VALUE_TOO_BIG);
        _add192(self, _time, uint192(_value));
    }

    /**
     * TODO
     */
    function lastUpdated(History storage self) internal view returns (uint256) {
        uint256 length = self.history.length;

        if (length > 0) {
            return uint256(self.history[length - 1].time);
        }

        return 0;
    }

    /**
     * @dev Fetch the latest registered value of history, it will return zero if there was no value registered
     * @param self Checkpoints history to be queried
     */
    function latestValue(History storage self) internal view returns (uint256) {
        uint256 length = self.history.length;
        if (length > 0) {
            return uint256(self.history[length - 1].value);
        }

        return 0;
    }

    /**
     * @dev Fetch the most recent registered past value of a history based on a given point in time that is not known
     *      how recent it is beforehand. It will return zero if there is no registered value or if given time is
     *      previous to the first registered value.
     *      It uses a binary search.
     *      Note that this function will be more suitable when don't know how recent the
     *      time used to index may be.
     * @param self Checkpoints history to be queried
     * @param _time Point in time to query the most recent registered past value of
     */
    function getValueAt(History storage self, uint64 _time) internal view returns (uint256) {
        // If there was no value registered for the given history return simply zero
        uint256 length = self.history.length;
        if (length == 0) {
            return 0;
        }

        // If the requested time is equal to or after the time of the latest registered value, return latest value
        uint256 lastIndex = length - 1;
        Checkpoint storage lastCheckpoint = self.history[lastIndex];
        if (_time >= lastCheckpoint.time) {
            return uint256(lastCheckpoint.value);
        }

        // If the requested time is previous to the first registered value, return zero to denote missing checkpoint
        if (length == 1 || _time < self.history[0].time) {
            return 0;
        }

        // Execute a binary search between the checkpointed times of the history
        uint256 low = 0;
        uint256 high = lastIndex - 1;

        while (high > low) {
            // No need for SafeMath: for this to overflow array size should be ~2^255
            uint256 mid = (high + low + 1) / 2;
            Checkpoint storage checkpoint = self.history[mid];
            uint64 midTime = checkpoint.time;

            if (_time > midTime) {
                low = mid;
            } else if (_time < midTime) {
                // No need for SafeMath: high > low >= 0 => high >= 1 => mid >= 1
                high = mid - 1;
            } else {
                return uint256(checkpoint.value);
            }
        }

        return uint256(self.history[low].value);
    }

    /**
     * @dev Private function to add a new value to a history for a given point in time. This function does not allow to
     *      add values previous to the latest registered value, if the value willing to add corresponds to the latest
     *      registered value, it will be updated.
     * @param self Checkpoints history to be altered
     * @param _time Point in time to register the given value
     * @param _value Numeric value to be registered at the given point in time
     */
    function _add192(History storage self, uint64 _time, uint192 _value) private {
        uint256 length = self.history.length;
        if (length == 0) {
            // If there was no value registered, we can insert it to the history directly.
            self.history.push(Checkpoint(_time, _value));
        } else {
            Checkpoint storage currentCheckpoint = self.history[length - 1];
            uint256 currentCheckpointTime = uint256(currentCheckpoint.time);

            if (_time > currentCheckpointTime) {
                // If the given point in time is after the latest registered value,
                // we can insert it to the history directly.
                self.history.push(Checkpoint(_time, _value));
            } else if (_time == currentCheckpointTime) {
                currentCheckpoint.value = _value;
            } else { // ensure list ordering
                // The given point cannot be before latest value, as past data cannot be changed
                revert(ERROR_PAST_CHECKPOINT);
            }
        }
    }
}
