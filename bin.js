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
require('./server.js')
