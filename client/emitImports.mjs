/*
	Usage:
	tsx emitImports [> "test/internals.js"]

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

const namePattern = process.argv[2] || '*.spec.*'
// prevent excessive imports
if (!namePattern.includes('.spec.')) throw `namePattern does not include '.spec'`

const specs = glob.sync(`./**/test/${namePattern}`, { cwd: __dirname })
specs.sort()

console.log(`import { matchSpecs, specsMatched } from './matchSpecs.js'`)
console.log(`import tape from 'tape'`)

const initialTest = `
// keep an initial test open until all spec modules have been loaded,
// to prevent an early-loaded and very fast test from closing the
// tape harness and ignoring late-loaded tests 
let assertAllTestLoaded
tape('loading of all import(spec)', test => {
	const exp = 5000
	test.timeoutAfter(exp)
	const start = Date.now()
	test.plan(1)
	assertAllTestLoaded = () => {
		if (Date.now() - start < exp) test.pass('should finish before this assertion is called')
		// else the timeoutAfter will be triggered without an assertion
		test.end()
	}
})
`
// only keep an initial test open if there are matching specs to test
if (specs.length) console.log(initialTest)

console.log(`const promises = []`)
// do not await on the dynamic import(), tape seems to collects all tests
// within a given time so that they can all run in sequence, otherwise
// if awaited, only the first spec file will run (tape seems to consider 
// all tests done at that point)
specs.forEach(f => console.log(`if (matchSpecs('${f}')) promises.push(import('../${f}'))`))

console.log(`// this resolves after all test modules are loaded, 
// but likely before all test code are fully evaluated and completed 
Promise.all(promises).then(()=>assertAllTestLoaded?.()).catch(e => {throw e})
`)

console.log(`export function getSpecs() { return specsMatched }`)
