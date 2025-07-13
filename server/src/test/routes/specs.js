/* these routes are for testing only */
import fs from 'fs'
import path from 'path'
import { minimatch } from 'minimatch'
import serverconfig from '../../serverconfig.js'

process.removeAllListeners('warning')

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

const clientAbs = path.join(import.meta.dirname, '../../../../client')
const sharedAbs = path.join(import.meta.dirname, '../../../../shared/utils')
const dirnames = [
	{
		abs: clientAbs,
		rel: ''
	},
	{
		abs: sharedAbs,
		rel: '../shared/utils/'
	}
]
const specsCache = {}

export function findMatchingSpecs(opts) {
	// may assign default patterns
	const SPECDIR = opts.dir ? `**/${opts.dir}` : '**'
	const SPECNAME = opts.name || '*'
	const exclude = 'exclude' in opts ? opts.exclude : SPECNAME.includes('_x_.') ? '' : '_x_.'
	const specPattern = `${SPECDIR}/test/${SPECNAME}.spec.*s`
	const allSpecs = []
	for (const dir of dirnames) {
		const pattern = path.join(dir.abs, specPattern)
		const specs =
			getFromCache(pattern) ||
			fs.globSync(pattern, { cwd: path.join(dir.abs, `./**`) }).filter(f => !exclude || !f.includes(exclude))
		specs.sort()
		if (!specsCache[pattern]) specsCache[pattern] = specs
		allSpecs.push(...specs.map(file => file.replace(dir.abs + '/', dir.rel)))
	}

	if (SPECDIR == '**' && SPECNAME == '*') {
		// this is a request for all spec files, can cache the results for
		// all other targeted spec searches, since glob.sync could be slow
		specsCache['*'] = allSpecs
	}

	return {
		matched: allSpecs,
		n: allSpecs.length,
		pattern: specPattern,
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
