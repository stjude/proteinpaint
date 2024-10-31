#!/usr/bin/env node
'use strict'

const path = require('path')
const ps = require('child_process')
const fs = require('fs')
const { execSync } = require('child_process')

let URLPATH = process.argv[2] || '.'
if (URLPATH.endsWith('/')) URLPATH = URLPATH.slice(0, -1)
let publicBinOnly = process.argv[3] === true

const CWD = process.cwd()

console.log('CWD', CWD)
try {
	if (!fs.existsSync(`${CWD}/public`)) {
		console.log(`making a public directory at ${CWD}`)
		fs.mkdirSync(`${CWD}/public`)
	}
	if (fs.existsSync(`${CWD}/public/bin`)) {
		console.log(`removing the old public/bin at ${CWD}`)
		// should update as part of v16 upgrade
		fs.rmdirSync(`${CWD}/public/bin`, { recursive: true, force: true }, () => {})
	}
	if (!publicBinOnly) {
		if (!fs.existsSync(`${CWD}/public/index.html`)) {
			console.log(`creating a public/index.html file`)
			fs.copyFileSync(path.join(__dirname, './public/index.html'), `${CWD}/public/index.html`)
		}
		if (!fs.existsSync(`${CWD}/public/cards`)) {
			console.log(`Copying cards into public/cards folder`)
			execSync(`cp -r ${CWD}/node_modules/@sjcrh/proteinpaint-front/public/cards ${CWD}/public/cards`, {
				stdio: 'inherit'
			})
		}
	}
	const tar = ps.spawnSync('tar', [`-xzf`, `${__dirname}/bundles.tgz`, `-C`, `${CWD}`], { encoding: 'utf8' })
	if (tar.stderr) throw tar.stderr
	console.log(`Setting the dynamic bundle path to ${URLPATH}`)
	const codeFile = `${CWD}/public/bin/proteinpaint.js`
	// remember the modified time before setting the bundle public path
	const mtime = fs.statSync(codeFile).mtime
	const code = fs.readFileSync(codeFile, { encoding: 'utf8' })
	const newcode = code.replace(`__PP_URL__`, `${URLPATH}/bin/`)
	fs.writeFileSync(codeFile, newcode, { encoding: 'utf8' }, () => {})
	try {
		// reset the atime and mtime to the original mtime before setting the bundle publit path
		fs.utimesSync(codepath, mtime, mtime)
	} catch (e) {
		console.log('--- !!! unable to reset the mtime for the extracted proteinpaint bundle: ', e)
	}
} catch (e) {
	console.error(e)
}
