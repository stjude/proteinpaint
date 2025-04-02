import path from 'path'
import { getClosestSpec } from '@sjcrh/augen'

/*
	This script can be
	- imported by another script to use getRelevantClientSpecs()
	- or called from command-line with the '-p' parameter to emit URL params or EMPTY flag
*/

const sharedUtilsDir = path.join(import.meta.dirname, '..')
const relevantSharedDirs = ['src']
const opts = {
	// changedFiles: ['termdb.bins.js'].map(f => `shared/utils/src/${f}`)
}

if (process.argv[1] == import.meta.dirname + '/closestSpec.js' && process.argv.includes('-p')) {
	console.log(getClosestSharedSpecs())
}

export function getClosestSharedSpecs() {
	return getClosestSpec(sharedUtilsDir, relevantSharedDirs, opts)
}
