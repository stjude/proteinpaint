#!/usr/bin/env node
const path = require('path')

process.env.PP_CUSTOMER = 'gdc'
process.env.PP_PORT = 3456
process.env.PP_MODE = 'container-test'
process.env.PP_BASEPATH = ''
const gdcConfig = require(path.join(__dirname, '../../server/src/serverconfig.js'))
console.log(JSON.stringify(gdcConfig, null, '    '))
