import {execSync} from 'child_process'

//  
// The exported aliases here are meant to temporarily address the issue
// of not having a dedicated unit spec file for each code file. This allows
// more accurate coverage reporting. 
//
// TODO: 
// - follow one-unit-spec-per-code-file convention
// - eventually not require this file 
//
export const aliases = {
	'tvs.categorical': {
		'unit': 'tvs'
	},
	'tvs.condition': {
		'unit': 'tvs'
	},
	'tvs.geneVariant': {
		'unit': 'tvs'
	},
	'tvs.numeric': {
		'unit': 'tvs'
	},
	'tvs.samplelst': {
		'unit': 'tvs'
	},
	'tvs.survival': {
		'unit': 'tvs'
	},
}

export function getReleventFiles() {
	const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }); console.log(34, branch)
	if (branch == 'master') {

	} else {
		const stagedStr = execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' })
		const files = stagedStr.trim().split('\n'); console.log(38, files)
	}
}

getReleventFiles()
