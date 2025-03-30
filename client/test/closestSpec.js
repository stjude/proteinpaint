import path from 'path'
import { getClosestSpec } from '@sjcrh/augen'

/*
	This script can be
	- imported by another script to use getRelevantClientSpecs()
	- or called from command-line with the '-p' parameter to emit URL params or EMPTY flag
*/

const clientDir = path.join(import.meta.dirname, '..')
const relevantClientDirs = [
	'common',
	'dom',
	'filter',
	'gdc',
	'mass',
	'plots',
	'rx',
	'src', // TODO: move all relevant dirs under src/
	'termdb',
	'termsetting',
	'tracks',
	'tw'
]
const opts = {
	//changedFiles: ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'FilterPrompt.js'].map(f => `client/filter/${f}`),
	changedFiles: ['handlers/snp.ts'].map(f => `client/termsetting/${f}`)
}

const EMPTY = 'NO_BRANCH_COVERAGE_UPDATE'

if (process.argv.includes('-p')) emitUrlParams()

export function getRelevantClientSpecs() {
	return getClosestSpec(clientDir, relevantClientDirs, opts)
}

function emitUrlParams() {
	const specs = getRelevantClientSpecs()
	const filesWithSpec = Object.entries(specs.matchedByFile)
	if (!filesWithSpec.length) {
		console.log(EMPTY)
	} else {
		const patterns = new Map()
		for (const [fileName, specs] of filesWithSpec) {
			if (!specs.length) continue
			// the first matched spec filename should have the same truncated filename as other matched specs entries
			const [specPath, specName] = specs[0].split('/test/')
			const specDir = specPath.split('/').pop()
			const truncatedSpecName = specName.split('.').slice(0, -3).join('.')
			const pattern = `dir=${specDir}&name=${truncatedSpecName}*`
			if (!patterns.has(pattern)) patterns.set(pattern, [])
			patterns.get(pattern).push(fileName)
		}

		// convert the pattern entries into valid URL parameter strings
		const params = []
		for (const [k, v] of patterns.entries()) {
			// use a hash to separate the dir+name pattern
			// from the list of files on which the patterm applies;
			// this hash should not be misinterpreted as being used
			// for browser navigation or to trigger a feature
			params.push(`${k}#${v.join(',')}`)
		}

		// console.log(patterns)
		console.log(!params.length ? EMPTY : params.join(' '))
	}
}
