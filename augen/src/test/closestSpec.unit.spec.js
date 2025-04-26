import tape from 'tape'
import { getClosestSpec, gitProjectRoot } from '../closestSpec.js'
import path from 'path'

/**************************************
 reusable globals and helper functions
**************************************/

// make this readonly for safer reuse across different tests
const specs = Object.freeze({
	toy: Object.freeze([
		'rel0/test/rel0.unit.spec.js',
		'rel0/test/aaa.unit.spec.js',
		'rel0/test/aaa.integration.spec.js',
		'rel0/test/zzz.unit.spec.js',

		'D1/test/D1.unit.spec.js',
		'D1/test/handlers/bbb.unit.spec.js',
		'D1/test/handlers/bbb.unit.spec.js'
	]),

	// although the spec filepaths below reflect actual workspace directories in the proteinpaint repo,
	// these are not expected to be maintained to always match actual directories; the real dirnames
	// are used mostly to make it easier to understand test cases
	client: Object.freeze([
		'filter/test/filter.integration.spec.js',
		'filter/test/tvs.unit.spec.js',
		'filter/test/tvs.integration.spec.js',

		'term/D1.unit.spec.js',
		'D0/D1/test/handlers/bbb.unit.spec.js',
		'D0/D1/test/handlers/bbb.unit.spec.js'
	])
})

const relevantSubdirs = {
	toy: ['rel0', 'D1'],
	client: ['rel0', 'D1']
}

/**************
 test sections
***************/

tape('simple getClosestSpec()', test => {
	const changedFiles = ['D0/rel0/aaa.js', 'D0/ignored/ccc.js']
	const D0dirname = path.join(gitProjectRoot, 'D0')
	const closestSpecs = getClosestSpec(D0dirname, relevantSubdirs.toy, {
		specs: specs.toy,
		changedFiles
	})
	test.deepEqual(
		closestSpecs,
		{
			matchedByFile: {
				'rel0/aaa.js': ['rel0/test/aaa.unit.spec.js', 'rel0/test/aaa.integration.spec.js']
			},
			matched: ['rel0/test/aaa.unit.spec.js', 'rel0/test/aaa.integration.spec.js'],
			numUnit: 1,
			numIntegration: 1
		},
		`should return the expected matched specs`
	)
	test.end()
})

tape('unchanged code files that are affected by changed spec file with similar name', test => {
	const changedFiles = ['D0/rel0/test/aaa.unit.spec.js']
	const D0dirname = path.join(gitProjectRoot, 'D0')
	const closestSpecs = getClosestSpec(D0dirname, relevantSubdirs.toy, {
		specs: specs.toy,
		changedFiles,
		codeFiles: ['rel0/aaa.js']
	})
	test.deepEqual(
		closestSpecs,
		{
			matchedByFile: {
				// To simplify relevant spec detection, matched unit and integration specs are always
				// run together if both are available. Running them separately will result in code files
				// having two different spec coverage results to track, which contradicts the goal of
				// trying to have one reference coverage run to guide writing effective tests for
				// a given code file.
				'rel0/test/aaa.unit.spec.js': ['rel0/test/aaa.unit.spec.js'],
				'rel0/aaa.js': ['rel0/test/aaa.unit.spec.js', 'rel0/test/aaa.integration.spec.js']
			},
			matched: ['rel0/test/aaa.unit.spec.js', 'rel0/test/aaa.integration.spec.js'],
			numUnit: 1,
			numIntegration: 1
		},
		`should return the expected matched specs for unchanged but affected code file`
	)
	test.end()
})

tape('unchanged code files that are affected by changed spec file named after directory', test => {
	const changedFiles = ['D0/rel0/test/zzz.unit.spec.js', 'D0/rel0/test/rel0.unit.spec.js']
	const D0dirname = path.join(gitProjectRoot, 'D0')
	const closestSpecs = getClosestSpec(D0dirname, relevantSubdirs.toy, {
		specs: specs.toy,
		changedFiles,
		codeFiles: ['rel0/bbb.js', 'rel0/zzz.js']
	})
	test.deepEqual(
		closestSpecs,
		{
			matchedByFile: {
				// To simplify relevant spec detection, matched unit and integration specs are always
				// run together if both are available. Running them separately will result in code files
				// having two different spec coverage results to track, which contradicts the goal of
				// trying to have one reference coverage run to guide writing effective tests for
				// a given code file.
				'rel0/test/zzz.unit.spec.js': ['rel0/test/zzz.unit.spec.js'],
				'rel0/test/rel0.unit.spec.js': ['rel0/test/rel0.unit.spec.js'],
				'rel0/zzz.js': ['rel0/test/zzz.unit.spec.js'],
				'rel0/bbb.js': ['rel0/test/rel0.unit.spec.js']
			},
			matched: ['rel0/test/zzz.unit.spec.js', 'rel0/test/rel0.unit.spec.js'],
			numUnit: 2,
			numIntegration: 0
		},
		`should return the expected matched specs for unchanged but affected code file`
	)
	test.end()
})
