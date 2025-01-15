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

const cwd = process.cwd()
const __dirname = import.meta.dirname

const namePattern = process.argv[2]
if (process.argv[2]) {
	console.log(getCodeText(process.argv[2]))
}

export function getCodeText(namePattern = '*.spec.*') {
	// prevent excessive imports
	if (!namePattern.includes('.spec.')) throw `namePattern does not include '.spec'`
	const ignore = ['dist/**', 'node_modules/**']
	const specs = glob
		.sync(`./**/test/${namePattern}`, { cwd: __dirname, ignore })
		.map(file => ({ file, rel: `../${file}` }))
	const sharedUtils = path.join(__dirname, '../shared/utils')
	const sharedSpecs = glob
		.sync(`./**/test/${namePattern}`, { cwd: sharedUtils, ignore })
		.map(file => ({ file: `shared/utils/${file}`, rel: `../../shared/utils/${file}` }))
	specs.push(...sharedSpecs)
	specs.sort()

	const output = []
	output.push(`import { matchSpecs, specsMatched } from './matchSpecs.js'`)
	output.push(`import tape from 'tape'`)

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
		console.log('NOTE: require() syntax in client spec files may cause this test to fail, use import syntax instead')
		assertAllTestLoaded = () => {
			if (Date.now() - start < exp) test.pass('should finish before this assertion is called')
			// else the timeoutAfter will be triggered without an assertion
			test.end()
		}
	})
	`
	// only keep an initial test open if there are matching specs to test
	if (specs.length) output.push(initialTest)

	output.push(`const promises = []`)
	// do not await on the dynamic import(), tape seems to collects all tests
	// within a given time so that they can all run in sequence, otherwise
	// if awaited, only the first spec file will run (tape seems to consider
	// all tests done at that point)
	specs.forEach(f => output.push(`if (matchSpecs('${f.file}')) promises.push(import('${f.rel}'))`))

	output.push(`// this resolves after all test modules are loaded, 
	// but likely before all test code are fully evaluated and completed 
	Promise.all(promises).then(()=>assertAllTestLoaded?.()).catch(e => {throw e})
	`)

	output.push(`export function getSpecs() { return specsMatched }`)

	const codeText = output.join('\n')
	return codeText
}

//if (outfile) fs.writeFileSync(path.join(__dirname, outfile), codeText)
//else console.log(codeText)
