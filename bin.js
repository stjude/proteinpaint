#!/usr/bin/env node

/*
	This script runs as the package binary, 
	
	$ npm install @stjude/proteinpaint
	$ npx proteinpaint
*/

// to-do, before starting the server:
// - merge updates to genomes and/or dataset as needed
// - option to redownload datasets

// option to use forever-monitor (to-do)
// - OR -

const fs = require('fs')
const pkg = require('./package.json')

// use the pp packages' public dir for index.html and /bin bundles
if (!fs.existsSync('public')) {
	if (pkg._where) {
		fs.symlink(pkg._where + '/node_modules/@stjude/proteinpaint/public', 'public', () => {})
	} else {
		fs.symlink(__dirname + '/public', 'public', () => {})
	}
}

require('./server.js')
