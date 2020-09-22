/*
	This script is used programatically with
	require('@stjude/proteinpaint').

	In contrast, bin.js is used via command-line.  
*/

const fs = require('fs')
const pkg = require('./package.json')
const execSync = require('child_process').execSync
const path = require('path')
const serverconfig = require(path.join(process.cwd(), './serverconfig.json'))

// use the pp packages' public dir for index.html and /bin bundles
const srcdir = pkg._where ? './node_modules/@stjude/proteinpaint' : __dirname //; console.log(14, pkg._where, __dirname, srcdir)

if (!fs.existsSync('public')) {
	console.log('Creating a public folder ...')
	execSync(`cp -r ${srcdir}/public .`)
}
console.log('Replacing the public/bin bundles ...')
execSync(`rm -rf ./public/bin`)
execSync(`cp -r ${srcdir}/public/bin ./public`)

const publicPath = serverconfig.URL ? serverconfig.URL : ''
console.log(`Setting the dynamic bundle path to '${publicPath}'`)
execSync(`rm ./public/bin/proteinpaint.js`)
execSync(
	`sed 's%__PP_URL__/bin/%${publicPath}/bin/%' < ${srcdir}/public/bin/proteinpaint.js > public/bin/proteinpaint.js`
)

require('./server.js')
