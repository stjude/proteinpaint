import path from 'path'
import { getClosestSpec } from '@sjcrh/augen'

/*
	This script can be
	- imported by another script to use getBranchClientSpecs()
	- or called from command-line with the '-p' parameter to emit URL params or EMPTY flag
*/

const serverDir = path.join(import.meta.dirname, '..')
const relevantServerDirs = ['routes', 'src', 'utils']
//const EMPTY = 'NO_BRANCH_COVERAGE_UPDATE'
const opts = {
	changedFiles: ['auth.js'].map(f => `server/src/${f}`)
}

//console.log(getBranchServerSpecs())

export function getBranchServerSpecs() {
	return getClosestSpec(serverDir, relevantServerDirs, opts)
}
