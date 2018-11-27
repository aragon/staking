#!/bin/bash

BASE_PATH=$(dirname $0)
CONTRACTS_PATH=${BASE_PATH}/../contracts
FLATTENED_PATH=${BASE_PATH}/../flattened_contracts

truffle compile
truffle exec ${BASE_PATH}/flatten_staking.js --network rpc
cp ${FLATTENED_PATH}/Staking.sol ${FLATTENED_PATH}/EchidnaStaking.sol
# Standard Token
#grep -v "^import" ${CONTRACTS_PATH}/test/mocks/StandardTokenMock.sol >> ${FLATTENED_PATH}/EchidnaStaking.sol
grep -v "^import" ${CONTRACTS_PATH}/test/mocks/NoApproveTokenMock.sol >> ${FLATTENED_PATH}/EchidnaStaking.sol
grep -v "^import" ${CONTRACTS_PATH}/test/EchidnaStaking.sol >> ${FLATTENED_PATH}/EchidnaStaking.sol
