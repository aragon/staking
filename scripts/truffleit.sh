#!/bin/bash

EMBARK_TEST_FOLDER=test_embark
TRUFFLE_TEST_FOLDER=test_truffle

echo "Converts Embark tests in folder ${EMBARK_TEST_FOLDER} into Truffle tests in folder ${TRUFFLE_TEST_FOLDER}"

mkdir -p ${TRUFFLE_TEST_FOLDER}
cp ${EMBARK_TEST_FOLDER}/*.js ${TRUFFLE_TEST_FOLDER}/

for test_file in $(ls ${TRUFFLE_TEST_FOLDER}/*.js); do
    echo ${test_file}
    sed -i "s/embark.require('Embark\/contracts\//artifacts.require('/g" ${test_file};
    sed -i "s/require('.\/helpers\/assertThrow')/require('@aragon\/test-helpers\/assertThrow')/g" ${test_file};
    sed -zi 's/let accounts\n\n//g' ${test_file};
    sed -zi "s/config({}, (err, accts) => {accounts = accts})\n\n//g" ${test_file};
    sed -i "s/const { getEvent } = require('.\/helpers\/getEvent')/const getEvent = (receipt, event, arg) => { return receipt.logs.filter(l => l.event == event)[0].args[arg] }/g" ${test_file};
    sed -i "s/contract('\([A-Za-z, ]*\)', ()/contract('\1', accounts/g" ${test_file};
    sed -i "s/deploy({arguments: \[\([A-Za-z, ]*\)\]}).send()/new(\1)/g" ${test_file};
    sed -i "s/deploy().send()/new()/g" ${test_file};
    sed -i "s/\.methods//g" ${test_file};
    sed -i "s/\.options//g" ${test_file};
    sed -i "s/)\.send({ from: \([A-Za-z0-9_]*\) })/, { from: \1 })/g" ${test_file};
    sed -i "s/\.send()//g" ${test_file};
    sed -i "s/)\.call({ from: \([A-Za-z0-9_]*\) })/, { from: \1 })/g" ${test_file};
    sed -i "s/\.call()//g" ${test_file};
    sed -i "s/web3\.utils\.toWei/web3\.toWei/g" ${test_file};
    sed -i "s/web3\.utils\.fromDecimal/web3\.fromDecimal/g" ${test_file};
    sed -i "s/web3\.utils\.asciiToHex('')/''/g" ${test_file};
    sed -i "s/web3\.utils\.BN/web3\.BigNumber/g" ${test_file};
    sed -i 's/const zeroBytes = "0x00"/const zeroBytes = "0x"/g' ${test_file};
    #sed -i "s///g" ${test_file};
done;
