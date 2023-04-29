// usage: node testconfig.js [dry]
//
// will create a copy of the current serverconfig.json
// and copy the test serverconfig.json to the current directory
// the test tpmasterdir will be set to current serverconfig.tpmasterdir

const serverconfig = require('./serverconfig.json')
const testconfig = require('./server/test/serverconfig.json')
const spawnSync = require('child_process').spawnSync
const path = require('path')
const fs = require('fs')

// backup the current serverconfig.json
const bkupname = './serverconfig-bkup.json'
spawnSync('mv', ['./serverconfig.json', bkupname], { encoding: 'utf-8' })
testconfig.tpmasterdir = serverconfig.tpmasterdir
testconfig.cachedir = serverconfig.cachedir
const json = JSON.stringify(testconfig, null, '  ')
if (process.argv[2] === 'dry') {
	console.log(json)
	spawnSync('mv', [bkupname, './serverconfig.json'], { encoding: 'utf-8' })
} else {
	fs.writeFileSync('./serverconfig.json', json, { encoding: 'utf-8' })
}
