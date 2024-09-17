/* these routes are for testing only */
import fs from 'fs'
import path from 'path'
import * as glob from 'glob'
import minimatch from 'minimatch'
import serverconfig from '../../serverconfig.js'

export default function setRoutes(app, basepath) {
	app.get(basepath + '/specs', async (req, res) => {
		try {
			const specs = findMatchingSpecs(req.query).matched.map(replaceFilePath)
			res.send({ specs })
		} catch (e) {
			throw e
		}
	})
}

/*
	Creates a target file to import matching test spec files.
	Whenever that target file is updated, it will 
	trigger a rebundling of the app in development mode

	opts{}
	.name 
		- a glob string to match against spec filenames under client/src
		- defaults to '*'
		- name=? (question mark) will create a target file if missing,
			but will not overwrite if it exists
	
	.dir 
		- a glob string to match against spec dir names under client/src
		- defaults to '**'

	.exclude
		- a substring for excluding any glob-matched files 
		- defaults to '_x_.': by convention spec
			files that are prefixed by this string require
			external test data that is not tracked by git.
			The default exclusion is meant to support continuous
			integration use case where all artifacts and tests must 
			be built from tracked source code.
	.
*/

const __dirname = path.join(import.meta.dirname, '../../../../client')
const specsCache = {}

export function findMatchingSpecs(opts) {
	// may assign default patterns
	const SPECDIR = opts.dir ? `**/${opts.dir}` : '**'
	const SPECNAME = opts.name || '*'
	const exclude = 'exclude' in opts ? opts.exclude : SPECNAME.includes('_x_.') ? '' : '_x_.'
	const pattern = path.join(__dirname, `./${SPECDIR}/test/${SPECNAME}.spec.*s`)
	const specs =
		getFromCache(pattern) ||
		glob.sync(pattern, { cwd: path.join(__dirname, `./**`) }).filter(f => !exclude || !f.includes(exclude))
	specs.sort()
	if (!specsCache[pattern]) specsCache[pattern] = specs
	if (SPECDIR == '**' && SPECNAME == '*') {
		// this is a request for all spec files, can cache the results for
		// all other targeted spec searches, since glob.sync could be slow
		specsCache['*'] = specs
	}

	const clientDir = __dirname.replace('client/test', 'client')
	// sorting preference for running the tests
	const specOrder = []
	specs.sort((a, b) => {
		const i = specOrder.indexOf(a)
		const j = specOrder.indexOf(b)
		if (i == -1 && j == -1) return 0
		if (i == -1) return 1
		if (j == -1) return -1
		return i - j
	})

	return {
		matched: specs.map(file => file.replace(clientDir + '/', '')),
		n: specs.length,
		pattern,
		exclude
	}
}

function getFromCache(pattern) {
	if (specsCache[pattern]) return specsCache[pattern]
	// prefer minimatch() against in-memory cache, which is much faster than glob.sync() against disk
	return specsCache['*']?.filter(f => minimatch(f, pattern))
}

function replaceFilePath(f) {
	return f.replace('../src/', '')
}
