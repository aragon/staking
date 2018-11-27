module.exports = {
    copyPackages: ['@aragon/os'],
    testCommand: 'truffle test test_truffle/*.js --network coverage',
    skipFiles: [
        'test/',
    ]
}
