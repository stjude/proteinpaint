import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const gitProjectRoot = path.join(import.meta.dirname, '../..') // execSync(`git rev-parse --show-toplevel`, { encoding: 'utf8' }).trim()
export const publicSpecsDir = path.join(gitProjectRoot, 'public/coverage/specs')

process.removeAllListeners('warning')

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
	const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' })

	let changedFiles
	if (opts.changedFiles) changedFiles = opts.changedFiles
	/* c8 ignore start */ else {
		const unstagedChanges = execSync(`git diff -M --name-status ${commitRef}`, { encoding: 'utf8' })
		const stagedChanges = execSync(`git diff -M --staged --name-status ${commitRef}`, { encoding: 'utf8' })
		const committedChanges = execSync(`git diff -M --name-status ${commitRef}..${branch}`, { encoding: 'utf8' })
		const modifiedFiles = [
			...new Set([
				...unstagedChanges.trim().split('\n'),
				...stagedChanges.trim().split('\n'),
				...committedChanges.trim().split('\n')
			])
		]
		// only added, modified, and renamed code files should be tested, skip deleted files
		changedFiles = modifiedFiles.filter(l => l[0] === 'A' || l[0] === 'M' || l[0] === 'R').map(l => l.split('\t').pop())
	}
	/* c8 ignore stop */
	changedFiles = changedFiles.filter(f => codeFileExt.has(path.extname(f)))
	changedFiles = new Set(changedFiles)

	const specs = opts.specs || fs.globSync(`**/test/*.spec.*s`, { cwd: dirname, ignore })

	// key: spec dir,name pattern
	// value: array of filenames that the pattern applies for test coverage
	const matchedByFile = {}
	const matched = []

	setMatchedSpecsByFile(matchedByFile, specs, matched, workspace, changedFiles, relevantSubdirs)

	// detect unchanged code files that may be affected by changes to a spec file
	const changedSpecs = [...changedFiles]
		.filter(f => f.includes('.unit.spec.') || f.includes('.integration.spec.'))
		.map(f => f.replace(workspace + '/', ''))
	const dedupedMatched = [...new Set(matched)]
	const scannedDirs = new Set()
	const exclude = f =>
		!changedFiles.has(f) &&
		(!f.includes('.unit.spec.') || !f.includes('.integration.spec.')) &&
		!f.includes('/test/') &&
		(f.endsWith('.js') || f.endsWith('.ts'))
	for (const m of dedupedMatched) {
		if (!m.includes('.spec.')) continue
		let dirname = path.dirname(m)
		if (dirname.endsWith('/test')) dirname = path.dirname(dirname)
		if (scannedDirs.has(dirname) || (!opts.codeFiles && !fs.existsSync(dirname))) continue
		scannedDirs.add(dirname)
		const codeFiles =
			opts.codeFiles ||
			fs
				.globSync(['*.*s', '**/*.*s'], { cwd: dirname })
				.filter(exclude)
				.map(f => `${dirname}/${f}`)
		if (!codeFiles.length) continue
		const unchangedMatchByFile = {}
		const unchangedMatched = []
		setMatchedSpecsByFile(
			unchangedMatchByFile,
			specs,
			unchangedMatched,
			workspace,
			new Set(codeFiles.map(f => `${workspace}/${f}`)),
			relevantSubdirs
		)
		for (const [f, mspecs] of Object.entries(unchangedMatchByFile)) {
			if (changedFiles.has(f) || !changedSpecs.find(m => mspecs.includes(m))) continue
			matchedByFile[f] = mspecs
			for (const s of mspecs) {
				if (!dedupedMatched.includes(s)) dedupedMatched.push(s)
			}
		}
	}

	// const nonSpecCodeFiles = fs.globSync(`**/test/*.spec.*s`, { cwd: dirname, ignore })
	// console.log(93, matchedByFile, matched)

	return {
		matchedByFile,
		matched: dedupedMatched,
		numUnit: dedupedMatched.filter(s => s.includes('.unit.spec.')).length,
		numIntegration: dedupedMatched.filter(s => s.includes('.integration.spec.')).length
	}
}

function setMatchedSpecsByFile(matchedByFile, specs, matched, workspace, changedFiles, relevantSubdirs) {
	const workspace_ = workspace + '/'

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
		if (f.includes('.unit.spec.') || f.includes('.integration.spec.')) {
			matchedByFile[f] = [f]
			if (!matched.includes(f)) matched.push(f)
			continue
		}
		matchedByFile[f] = [] // default no matched spec, may be replaced below

		const fileName = path.basename(f)
		const fileNameSegments = fileName.split('.')
		// try to find the closest matching spec name based on the filename
		while (fileNameSegments.length > 1) {
			fileNameSegments.pop()
			const truncatedFilename = fileNameSegments.join('.')
			const unitName = `${truncatedFilename}.unit.spec.`
			const integrationName = `${truncatedFilename}.integration.spec.`
			// To simplify relevant spec detection, matched unit and integration specs are always
			// run together if both are available. Running them separately will result in code files
			// having two different spec coverage results to track, which contradicts the goal of
			// trying to have one reference coverage run to guide writing effective tests for
			// a given code file.
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

		if (!matchedByFile[f].length) {
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
}
