/*
	Usage:
	tsx [path/]emitImports [app | unit] > ["server.js" | "serverTests.js"]

	- emit imports for dev server process (app) or running tests (unit)
	- the imports will trigger server restart when the target file is used with `tsx watch $targefile`
  - call from the working dir with a serverconfig.json

*/

import fs from 'fs'
import path from 'path'
import * as glob from 'glob'

const mode = process.argv[2]
const cwd = process.cwd()
const __dirname = import.meta.dirname
// assume that the proteinpaint dir is a submodule under cwd,
let relpath = __dirname.replace(cwd, '.')
if (!relpath) relpath = '.'

if (mode == 'dev') {
	const imports = []
	const hasServerConfig = fs.existsSync(`./serverconfig.json`)
	if (hasServerConfig) imports.push(`import './serverconfig.json'`)

	for (const dir of ['genome', 'dataset']) {
		const cwds = { [path.join(__dirname, dir)]: relpath }
		if (__dirname !== cwd) cwds[path.join(cwd, dir)] = '.'

		for (const cwd in cwds) {
			const files = glob.sync('*.ts', { cwd })
			for (const f of files) {
				//if (f == 'cgc.ts') continue
				const abspath = `${cwd}/${f}`
				const dotpath = cwds[cwd]
				const frelpath = `${dotpath}/${dir}/${f}`
				if (!fs.existsSync(abspath)) continue
				//const vname = f == 'clinvar.js' ? '* as clinvar' : normalizeName(f)
				imports.push(`import '${frelpath}'`)
				// const v = await import(abspath) //; if (f == 'termdb.test.js') console.log(v)
				// const { isMds3, isMds2, isMds, isMinGenome } = v.default || v
				// const vtype = isMds3 ? 'Mds3' : isMds2 ? 'any' : isMds ? 'Mds' : isMinGenome ? 'MinGenome' : 'Genome'
				// if (f == 'clinvar.js') {
				// 	vartypes.push(`const v${i}a: ClinvarClinsig = clinvar.clinsig`)
				// 	vartypes.push(`const v${i}b: ClinvarAF = clinvar.AF`)
				// } else {
				// 	vartypes.push(`const v${i}: ${vtype} = ${vname}`)
				// }
				// i++
			}
		}
	}

	if (hasServerConfig) imports.push(`import { launch } from '${relpath}/src/app.ts'`)
	console.log(imports.join('\n'))
	//console.log(vartypes.join('\n'))
	if (hasServerConfig) console.log('launch()')
} else if (mode == 'unit') {
	const specs = glob.sync('./**/test/*.unit.spec.*', { cwd: __dirname })
	const imports = specs.map(f => `import '${f}'`)
	console.log(imports.join('\n'))
}

function normalizeName(name) {
	return name.replace('-', '').split('/').pop().split('.').slice(0, -1).join('')
}
