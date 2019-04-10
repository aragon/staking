#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit -o pipefail

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the geth instance that we started (if we started one and if it's still running).
  if [ -n "$geth_pid" ] && ps -p $geth_pid > /dev/null; then
    kill -9 $geth_pid
  fi
}

setup() {
  PORT=8545
  NETWORK=development
  GASLIMIT=8000000
  OUTPUT_FILE=/dev/null
}

start_geth() {
  # Start a geth instance in background
  echo "Starting local dev geth in port $PORT..."

  nohup geth \
    --rpc \
    --rpcport ${PORT} \
    --rpcaddr 'localhost' \
    --rpccorsdomain '*' \
    --rpcapi 'personal,web3,eth,net' \
    --dev \
    --dev.period 1 \
    --networkid ${PORT} \
    --targetgaslimit ${GASLIMIT} \
    > ${OUTPUT_FILE} &

  geth_pid=$!
  sleep 5
  echo "Running local dev geth with pid ${geth_pid} in port $PORT"
}

run_tests() {
  echo "Running tests..."
  npx truffle test --network ${NETWORK} "$@"
}

setup
start_geth
run_tests
