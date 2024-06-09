/*
	Usage:
	tsx emitImports [> "test/internals.js"]

	- emit imports for dev server process (app) or running tests (unit)
	- the imports will trigger server restart when the target file is used with `tsx watch $targefile`
  - call from the working dir with a serverconfig.json

*/

import fs from 'fs'
import path from 'path'

const { default: glob } = await import('glob')
const mode = process.argv[2]
const cwd = process.cwd()
const __dirname = import.meta.dirname

const specs = glob.sync('./**/test/*.unit.spec.*', { cwd: __dirname })
console.log(`import { matchSpecs } from './matchSpecs.mjs'`)
specs.forEach(f => console.log(`if (matchSpecs('${f}')) await import('.${f}')`))
