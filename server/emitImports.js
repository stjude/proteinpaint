/*
	Usage:
	tsx [path/]emitImports [app | unit] > ["server.js" | "serverTests.js"]

	- emit imports for dev server process (app) or running tests (unit)
	- the imports will trigger server restart when the target file is used with `tsx watch $targefile`
  - call from the working dir with a serverconfig.json

*/

import fs from 'fs'
import path from 'path'

process.removeAllListeners('warning')

const mode = process.argv[2]
const cwd = process.cwd()
const __dirname = import.meta.dirname
// assume that the proteinpaint dir is a submodule under cwd,
let relpath = __dirname.replace(cwd, '.')
if (!relpath) relpath = '.'

const hasServerConfig = fs.existsSync(`./serverconfig.json`)
const comment = `// this file is auto-generated by server/emitImports.js, do not edit manually`

if (mode == 'dev') {
	const imports = [comment]
	if (hasServerConfig) imports.push(`import './serverconfig.json'`)

	for (const dir of ['genome', 'dataset']) {
		const cwds = { [path.join(__dirname, dir)]: relpath }
		if (__dirname !== cwd) cwds[path.join(cwd, dir)] = '.'

		for (const cwd in cwds) {
			const files = fs.globSync('*.ts', { cwd })
			for (const f of files) {
				const abspath = `${cwd}/${f}`
				const dotpath = cwds[cwd]
				const frelpath = `${dotpath}/${dir}/${f}`
				if (!fs.existsSync(abspath)) continue
				imports.push(`import '${frelpath}'`)
			}
		}
	}

	if (hasServerConfig) imports.push(`import { launch } from '${relpath}/src/app.ts'`)
	console.log(imports.join('\n'))
	if (hasServerConfig) console.log('await launch()')
} else if (mode == 'unit') {
	if (!hasServerConfig) {
		const configStr = fs.readFileSync('../container/ci/serverconfig.json', { encoding: 'utf8' })
		const config = JSON.parse(configStr)
		config.tpmasterdir = path.join(__dirname, 'test/tp')
		config.cachedir = path.join(__dirname, 'test/cache')
		fs.writeFileSync(path.join(__dirname, './serverconfig.json'), JSON.stringify(config, null, '    '))
	}
	const specs = fs.globSync('./**/test/*.unit.spec.*', { cwd: __dirname, exclude: ['node_modules/**'] })
	const imports = [comment, ...specs.map(f => `import './${f}'`)]
	console.log(imports.join('\n'))
}

function normalizeName(name) {
	return name.replace('-', '').split('/').pop().split('.').slice(0, -1).join('')
}
