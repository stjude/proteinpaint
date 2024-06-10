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

const specs = glob.sync('./**/test/*.spec.*', { cwd: __dirname })
console.log(`import { matchSpecs } from './matchSpecs.js'`)
console.log(`export function runTests() {`)
// do not await on the dynamic import(), tape seems to collects all tests
// within a given time so that they can all run in sequence, otherwise
// if awaited, only the first spec file will run (tape seems to consider 
// all tests done at that point)
specs.forEach(f => console.log(`\tif (matchSpecs('${f}')) import('.${f}')`))
console.log(`}`)
