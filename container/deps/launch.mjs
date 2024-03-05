#!/usr/bin/env node

import path from 'path'
import { spawnSync } from 'child_process'

// from the current working directory
spawnSync(`rm -rf public/cards`)

const mode = process.argv[2] || 'full'
const run = path.join(import.meta.dirname, 'run.sh')

try {
	const img = `ghcr.io/stjude/pp${mode}:latest`
	console.log(`starting ${img} ...`)
	const out = spawnSync('bash', [run, img, 'pp'], { encoding: 'utf-8' })
	if (out.stderr) throw out.stderr
	else console.log(out.stdout)
} catch (e) {
	console.error(e)
}
