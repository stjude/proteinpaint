import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const gitProjectRoot = path.join(import.meta.dirname, '../..') // execSync(`git rev-parse --show-toplevel`, { encoding: 'utf8' }).trim()
export const publicSpecsDir = path.join(gitProjectRoot, 'public/coverage/specs')

const ignore = ['dist/**', 'node_modules/**']
const codeFileExt = new Set(['.js', '.mjs', '.cjs', '.ts'])
let commitRef

/*
	dirname: the directory name of the 
	relevantSubdir: string[] // array of subdirectory names under the workspace dir that have relevant code for test coverage
*/

export function getClosestSpec(dirname, relevantSubdirs = [], opts = {}) {
	if (!commitRef) {
		const commitRefFile = path.join(gitProjectRoot, 'public/coverage/commitRef')
		if (!fs.existsSync(commitRefFile)) {
			/* c8 ignore start */
			console.log(`!!! missing '${commitRefFile}' !!!`)
			return {
				matchedByFile: {},
				matched: [],
				numUnit: 0,
				numIntegration: 0
			}
			/* c8 ignore stop */
		}
		commitRef = fs.readFileSync(commitRefFile, { encoding: 'utf8' }).trim()
		// to suppress warning related to experimental fs.globSync(),
		// only applies to the runtime where this script is called
		process.removeAllListeners('warning')
	}

	const workspace = dirname.replace(gitProjectRoot + '/', '')
	const workspace_ = workspace + '/'
	const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' })

	let changedFiles
	if (opts.changedFiles) changedFiles = opts.changedFiles
	/* c8 ignore start */ else {
		const modifiedFiles = execSync(`git diff --name-status ${commitRef}..${branch}`, { encoding: 'utf8' })
		// only added and modified code files should be tested
		const committedFiles = modifiedFiles
			.split('\n')
			.filter(l => l[0] === 'A' || l[0] === 'M')
			.map(l => l.split('\t').pop())

		// detect staged files for local testing, should not have any in github CI
		// const stagedFiles = execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' })
		const diffFiles = execSync(`git diff --name-only HEAD | sed 's| |\\ |g'`, { encoding: 'utf8' })
		changedFiles = [...committedFiles, ...diffFiles.trim().split('\n')]
	}
	/* c8 ignore stop */
	changedFiles = changedFiles.filter(f => codeFileExt.has(path.extname(f)))
	changedFiles = new Set(changedFiles)

	const specs = opts.specs || fs.globSync(`**/test/*.spec.*s`, { cwd: dirname, ignore })

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
		// try to find the closest matching spec name based on the filename
		while (fileNameSegments.length > 1) {
			fileNameSegments.pop()
			const truncatedFilename = fileNameSegments.join('.')
			const unitName = `${truncatedFilename}.unit.spec.`
			const integrationName = `${truncatedFilename}.integration.spec.`
			const matchedSpecs = specs.filter(s => {
				if (!s.includes(unitName) && !s.includes(integrationName)) return false
				const spath = s.slice(0, s.indexOf(`/test/`))
				return f.startsWith(spath)
			})
			if (matchedSpecs.length) {
				matchedByFile[f] = matchedSpecs
				matched.push(...matchedSpecs)
				break
			}
		}

		if (!matched.length) {
			// try to find the closest matching spec name based on directory name
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

	const dedupedMatched = [...new Set(matched)]
	return {
		matchedByFile,
		matched: dedupedMatched,
		numUnit: dedupedMatched.filter(s => s.includes('.unit.spec.')).length,
		numIntegration: dedupedMatched.filter(s => s.includes('.integration.spec.')).length
	}
}
