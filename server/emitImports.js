/*
	Usage:
	tsx [path/]emitImports [app | unit] > ["server.js" | "serverTests.js"]

	- emit imports for dev server process (app) or running tests (unit)
	- the imports will trigger server restart when the target file is used with `tsx watch $targefile`
  - call from the working dir with a serverconfig.json

*/

import glob from 'glob'
import fs from 'fs'
import path from 'path'

const mode = process.argv[2]
const cwd = process.cwd()
const __dirname = import.meta.dirname
let relpath = __dirname
	.replace(cwd, '')
	.split('/')
	.filter(p => p && true)
	.map(p => '..')
	.join('/')
if (!relpath) relpath = '.'

if (mode == 'dev') {
	const imports = [`import serverconfig from '${relpath}/serverconfig.json'`] //; console.log()
	for (const dir of ['genome', 'dataset']) {
		const genomes = glob.sync('*.ts', { cwd: path.join(__dirname, dir) })
		imports.push(...genomes.map(f => `import * as ${normalizeName(f)} from './${dir}/${f}'`))

		if (__dirname !== cwd) {
			// assumes there are no filename collissions between dataset files in cwd and proteinpaint/server/genomes
			const genomes = glob.sync('*.ts', { cwd: path.join(cwd, dir) })
			imports.push(...genomes.map(f => `import '${relpath}/${dir}/${f}'`))
		}
	}

	imports.push(`import {launch} from './src/app.ts'`)
	imports.push(`launch()`)
	console.log(imports.join('\n'))
} else if (mode == 'unit') {
	const specs = glob.sync('./**/test/*.unit.spec.*', { cwd: __dirname })
	const imports = specs.map(f => `import '${f}'`)
	console.log(imports.join('\n'))
}

function normalizeName(name) {
	return name.replace('-', '').split('/').pop().split('.').slice(0, -1).join('')
}
