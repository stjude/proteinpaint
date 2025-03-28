import path from 'path'
import { getClosestSpec } from '@sjcrh/augen'

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

const EMPTY = 'NO_BRANCH_COVERAGE_UPDATE'
const clientDir = path.join(import.meta.dirname, '..')
const matchedSpecsByFile = getClosestSpec(clientDir, relevantClientDirs)
const filesWithSpec = Object.entries(matchedSpecsByFile)
if (!filesWithSpec.length) {
	console.log(EMPTY)
} else {
	const patterns = new Map()
	for (const [fileName, specs] of filesWithSpec) {
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
