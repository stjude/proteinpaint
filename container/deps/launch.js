#!/usr/bin/env node

const path = require('path')
const spawnSync = require('child_process').spawnSync

// from the current working directory
spawnSync(`rm -rf public/cards`)

const mode = process.argv[2] || 'full'
const run = path.join(__dirname, 'run.sh')

try {
	const img = `ghcr.io/stjude/pp${mode}:latest`
	console.log(`starting ${img} ...`)
	const out = spawnSync('bash', [run, img, 'pp'], { encoding: 'utf-8' })
	if (out.stderr) throw out.stderr
	else console.log(out.stdout)
} catch (e) {
	console.error(e)
}
