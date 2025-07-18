/*
	Usage:

	# run from the shared/utils dir
	tsx emitImports > test/internals-test.js 

	- emit imports for running tests
*/

import fs from 'fs'

console.log(`// this file is auto-generated by shared/utils/emitImports.js, do not edit manually\n`)
const specs = fs.globSync('**/test/*.unit.spec.*', { cwd: import.meta.dirname })
const imports = specs.map(f => `import '../${f}'`)
console.log(imports.join('\n'))
