#!/usr/bin/env node
'use strict'

const path = require('path')
const ps = require('child_process')
const fs = require('fs')

const URLPATH = process.argv[2] || '.'
const CWD = process.cwd()
try {
	if (!fs.existsSync(`${CWD}/public`)) {
		console.log(`making a public directory at ${CWD}`)
		fs.mkdirSync(`${CWD}/public`)
	}
	if (!fs.existsSync(`${CWD}/public/index.html`)) {
		console.log(`creating a public/index.html file`)
		fs.copyFileSync(path.join(__dirname, './public/index.html'), `${CWD}/public/index.html`)
	}
	if (fs.existsSync(`${CWD}/public/bin`)) {
		console.log(`removing the old public/bin at ${CWD}`)
		// TODO: node 12 in pp-prt does not support rmSync,
		// should update as part of v16 upgrade
		fs.rmdirSync(`${CWD}/public/bin`, { recursive: true, force: true }, () => {})
	}
	const tar = ps.spawnSync('tar', [`-xzf`, `${__dirname}/bundles.tgz`, `-C`, `${CWD}`], { encoding: 'utf8' })
	if (tar.stderr) throw tar.stderr
	console.log(`Setting the dynamic bundle path to ${URLPATH}`)
	const codeFile = `${CWD}/public/bin/proteinpaint.js`
	const code = fs.readFileSync(codeFile, { encoding: 'utf8' })
	const newcode = code.replace(`__PP_URL__`, `${URLPATH}/bin/`)
	fs.writeFileSync(codeFile, newcode, { encoding: 'utf8' }, () => {})
} catch (e) {
	console.error(e)
}
