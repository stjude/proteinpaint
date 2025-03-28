import { execSync } from 'child_process'
import path from 'path'
import * as glob from 'glob'
//import { minimatch } from 'minimatch'

/*
	dirname: the directory name of the 
	relevantSubdir: string[] // array of subdirectory names under the workspace dir that have relevant code for test coverage
*/

export function getClosestSpec(dirname, relevantSubdirs = []) {
	const workspace_ = dirname.split('/').pop() + '/'
	const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' })
	// TODO: may need to detect release branch instead of master
	const modifiedFiles = execSync(`git diff --name-status master..${branch}`, { encoding: 'utf8' })
	// only added and modified code files should be tested
	const committedFiles = modifiedFiles
		.split('\n')
		.filter(l => l[0] === 'A' || l[0] === 'M')
		.map(l => l.split('\t').pop()) //; console.log(10, committedFiles)
	// detect staged files for local testing, should not have any in github CI
	const stagedFiles =
		// ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'FilterPrompt.js'].map(f => `client/filter/${f}`) || // uncomment to test
		execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' }) // comment to test
	const changedFiles = new Set([...committedFiles, ...stagedFiles]) //; console.log(12, changedFiles)

	const ignore = ['dist/**', 'node_modules/**']
	const specs = glob.sync(`**/test/*.spec.*s`, { cwd: dirname, ignore })

	// key: spec dir,name pattern
	// value: array of filenames that the pattern applies for test coverage
	const matchedSpecsByFile = {}

	for (const wf of changedFiles) {
		if (!wf.startsWith(workspace_)) continue
		const f = wf.replace(workspace_, '')
		// assume that an empty relevantSubDirs array means all subdirs are relevant
		let matched = !relevantSubdirs.length // || false
		if (!matched) {
			for (const dir of relevantSubdirs) {
				if (f.startsWith(`${dir}/`)) {
					matched = true
					break
				}
			}
		}
		if (!matched) continue

		matchedSpecsByFile[f] = [] // default no matched spec, may be replaced below
		const fileName = f.split('/').pop()
		const fileNameSegments = fileName.split('.')
		const filedir = f.split('/').slice(-2, 1)[0]

		while (fileNameSegments.length) {
			fileNameSegments.pop()
			const truncatedFilename = fileNameSegments.length ? fileNameSegments.join('.') : filedir
			// console.log(50, {truncatedFilename}, `${truncatedFilename}.unit.spec`)
			const unitName = `${truncatedFilename}.unit.spec.`
			const integrationName = `/${truncatedFilename}.integration.spec.`
			const matched = specs.filter(f => f.includes(unitName) || f.includes(integrationName))
			if (matched.length) {
				matchedSpecsByFile[f] = matched
				break
			}
		}
	}

	return matchedSpecsByFile
}
