#!/usr/bin/env node
const path = require('path')

process.env.PP_CUSTOMER = 'gdc'
process.env.PP_PORT = 3456
const gdcConfig = require(path.join(__dirname, '../../server/src/serverconfig.js'))
// need to access the tpmasterdir location
const localConfig = require(path.join(__dirname, '../../../serverconfig.json'))

gdcConfig.tpmasterdir = localConfig.tpmasterdir
gdcConfig.cachedir = localConfig.cachedir
gdcConfig.bigwigsummary = localConfig.bigwigsummary
gdcConfig.hicstraw = localConfig.hicstraw

console.log(JSON.stringify(gdcConfig, null, '    '))
