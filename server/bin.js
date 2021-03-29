#!/usr/bin/env node

/*
	- This script loads the server configuration, with
	possible overrides applied at runtime. 

	- It may remove or add a public folder + bin files,
	or change a bundle's publicPath for dynamically
	loading code chunks, depending on the usage context. 

	- It then launches the ProteinPaint server from the command line. 
	
	Usage:
	
	$ npm install @stjude/proteinpaint
	$ npx proteinpaint
*/

const pkg = require('./package.json')
const fs = require('fs')
const execSync = require('child_process').execSync
const path = require('path')
const serverconfig = require('./src/serverconfig.js')

if (serverconfig.backend_only) {
	execSync(`rm -rf ./public`)
	execSync(`rm -rf ./dist`)
} else if (!fs.existsSync('.git')) {
	// do not do the following in a dev environment

	// use the pp packages' public dir for index.html and /bin bundles
	const srcdir = pkg._where ? './node_modules/@stjude/proteinpaint' : __dirname

	if (!fs.existsSync('public')) {
		console.log('Creating a public folder ...')
		execSync(`cp -r ${srcdir}/public .`)
	}

	console.log('Replacing the public/bin bundles ...')

	// in case of usage as a node_module, would need to copy
	// the pp bin bundles from node_modules/@stjude/proteinpaint to the app directory
	if (pkg._where) {
		execSync(`rm -rf ./public/bin`)
		execSync(`cp -r ${srcdir}/public/bin ./public`)
	}

	const publicPath = serverconfig.URL ? serverconfig.URL : ''
	console.log(`Setting the dynamic bundle path to '${publicPath}'`)
	execSync(`mv ./public/bin/proteinpaint.js ./public/bin/proteinpaint-bk.js`)
	execSync(`sed 's%__PP_URL__/bin/%${publicPath}/bin/%' < ./public/bin/proteinpaint-bk.js > public/bin/proteinpaint.js`)
}

require('./server.js')
