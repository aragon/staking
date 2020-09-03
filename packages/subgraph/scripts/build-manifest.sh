#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Staking Factory known addresses
factory_rinkeby=0x07429001eeA415E967C57B8d43484233d57F8b0B
factory_mainnet=0xd2f7d8a940324f12dfe623d5529b077e353314d3

# Known block numbers
start_block_rinkeby=6921112
start_block_mainnet=10769761

# Validate network
networks=(rinkeby mainnet)
if [[ -z $NETWORK || ! " ${networks[@]} " =~ " ${NETWORK} " ]]; then
  echo 'Please make sure the network provided is either rinkeby or mainnet.'
  exit 1
fi

# Use mainnet network in case of local deployment
if [[ "$NETWORK" = "rpc" ]]; then
  ENV='mainnet'
elif [[ "$NETWORK" = "staging" ]]; then
  ENV='rinkeby'
else
  ENV=${NETWORK}
fi

# Load start block
if [[ -z $START_BLOCK ]]; then
  START_BLOCK_VAR=start_block_$NETWORK
  START_BLOCK=${!START_BLOCK_VAR}
fi
if [[ -z $START_BLOCK ]]; then
  START_BLOCK=0
fi

# Try loading a Staking Factory address if missing
if [[ -z $FACTORY ]]; then
  FACTORY_VAR=factory_$NETWORK
  FACTORY=${!FACTORY_VAR}
fi

# Validate staking address
if [[ -z $FACTORY ]]; then
  echo 'Please make sure a Staking Factory address is provided'
  exit 1
fi

# Remove previous subgraph if there is any
if [ -f subgraph.yaml ]; then
  echo 'Removing previous subgraph manifest...'
  rm subgraph.yaml
fi

# Build subgraph manifest for requested variables
echo "Preparing new subgraph for Staking using factory address ${FACTORY} to network ${NETWORK}"
cp subgraph.template.yaml subgraph.yaml
sed -i -e "s/{{network}}/${ENV}/g" subgraph.yaml
sed -i -e "s/{{factory}}/${FACTORY}/g" subgraph.yaml
sed -i -e "s/{{startBlock}}/${START_BLOCK}/g" subgraph.yaml
rm -f subgraph.yaml-e
