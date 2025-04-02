/*
	Usage:

	# run from the shared/utils dir
	tsx emitImports > test/internals-test.js 

	- emit imports for running tests
*/

import * as glob from 'glob'

const specs = glob.sync('./**/test/*.unit.spec.*', { cwd: import.meta.dirname })
const imports = specs.map(f => `import '../${f}'`)
console.log(imports.join('\n'))
