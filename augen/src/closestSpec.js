import { execSync } from 'child_process'
import path from 'path'
import * as glob from 'glob'
//import { minimatch } from 'minimatch'

/*
	dirname: the directory name of the 
	relevantSubdir: string[] // array of subdirectory names under the workspace dir that have relevant code for test coverage
*/

const gitProjectRoot = execSync(`git rev-parse --show-toplevel`, { encoding: 'utf8' }).trim()
// this cache will persist in the same node call
// const matchedByDirFile = new Map()

export function getClosestSpec(dirname, relevantSubdirs = [], opts = {}) {
	const workspace = dirname.replace(gitProjectRoot + '/', '')
	const workspace_ = workspace + '/'
	// if (opts.cache && matchedByDirFile.has(workspace)) return matchedByDirFile.get(workspace)

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
		opts.stagedFiles || execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' })
	const changedFiles = new Set([...committedFiles, ...stagedFiles]) //; console.log({changedFiles})

	const ignore = ['dist/**', 'node_modules/**']
	const specs = glob.sync(`**/test/*.spec.*s`, { cwd: dirname, ignore })

	// key: spec dir,name pattern
	// value: array of filenames that the pattern applies for test coverage
	const matchedByFile = {}
	const matched = []

	for (const wf of changedFiles) {
		if (!wf.startsWith(workspace_)) continue
		const f = wf.replace(workspace_, '')
		// assume that an empty relevantSubDirs array means all subdirs are relevant
		let isRelevant = !relevantSubdirs.length // || false
		if (!isRelevant) {
			for (const dir of relevantSubdirs) {
				if (f.startsWith(`${dir}/`)) {
					isRelevant = true
					break
				}
			}
		}
		if (!isRelevant) continue

		matchedByFile[f] = [] // default no matched spec, may be replaced below

		const fileName = path.basename(f)
		const fileNameSegments = fileName.split('.')
		while (fileNameSegments.length > 1) {
			fileNameSegments.pop()
			const truncatedFilename = fileNameSegments.join('.')
			// console.log(50, {truncatedFilename}, `${truncatedFilename}.unit.spec`)
			const unitName = `${truncatedFilename}.unit.spec.`
			const integrationName = `/${truncatedFilename}.integration.spec.`
			const matchedSpecs = specs.filter(f => f.includes(unitName) || f.includes(integrationName))
			if (matchedSpecs.length) {
				matchedByFile[f] = matchedSpecs
				matched.push(...matchedSpecs)
				break
			}
		}

		if (!matched.length) {
			const dirPath = path.dirname(f)
			const dirPathSegments = dirPath.split('/')
			while (dirPathSegments.length) {
				const dir = dirPathSegments.pop()
				const unitName = `${dir}.unit.spec.`
				const integrationName = `${dir}.integration.spec.`
				const matchedSpecs = specs.filter(f => f.includes(unitName) || f.includes(integrationName))
				if (matchedSpecs.length) {
					matchedByFile[f] = matchedSpecs
					matched.push(...matchedSpecs)
					break
				}
			}
		}
	}

	// if (opts.cache) matchedByDirFile.set(workspace, matchedByFile)
	const dedupedMatched = [...new Set(matched)]
	return {
		matchedByFile,
		matched: dedupedMatched,
		numUnit: dedupedMatched.filter(s => s.includes('.unit.spec.')).length,
		numIntegration: dedupedMatched.filter(s => s.includes('.integration.spec.')).length
	}
}
