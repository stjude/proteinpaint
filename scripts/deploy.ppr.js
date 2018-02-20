/*
$ npm run ppr
*/

const exec = require('child_process').execSync
const path = require('path')

// get host
const config = require('../serverconfig.json')
const host = config.host || 'http://localhost:3000'

exec("sh ./scripts/deploy.ppr.sh "+host)
