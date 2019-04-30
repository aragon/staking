const flatten = require('truffle-flattener')
const mkdirp = require('mkdirp')
const fs = require('fs')
const path = require('path')

const FLATTEN_DIR = './flattened_contracts'

module.exports = async (instance) => {
  const {
    contractName,
    sourcePath
  } = instance.constructor._json

  const flattenedCode = await flatten([ sourcePath ])
  mkdirp.sync(FLATTEN_DIR)
  const savePath = path.join(FLATTEN_DIR, `${contractName}.sol`)
  fs.writeFileSync(savePath, flattenedCode)
}
