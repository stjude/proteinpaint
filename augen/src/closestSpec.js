import { execSync } from 'child_process'
import path from 'path'
import * as glob from 'glob'
import fs from 'fs'

export const gitProjectRoot = execSync(`git rev-parse --show-toplevel`, { encoding: 'utf8' }).trim()
const ignore = ['dist/**', 'node_modules/**']
const codeFileExt = new Set(['.js', '.mjs', '.cjs', '.ts'])

/*
	dirname: the directory name of the 
	relevantSubdir: string[] // array of subdirectory names under the workspace dir that have relevant code for test coverage
*/

export function getClosestSpec(dirname, relevantSubdirs = [], opts = {}) {
	const workspace = dirname.replace(gitProjectRoot + '/', '')
	const workspace_ = workspace + '/'

	const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' })

	let changedFiles
	if (opts.changedFiles) changedFiles = opts.changedFiles
	else {
		// TODO: may need to detect release branch instead of master
		const modifiedFiles = execSync(`git diff --name-status master..${branch}`, { encoding: 'utf8' })
		// only added and modified code files should be tested
		const committedFiles = modifiedFiles
			.split('\n')
			.filter(l => l[0] === 'A' || l[0] === 'M')
			.map(l => l.split('\t').pop())

		// detect staged files for local testing, should not have any in github CI
		const stagedFiles = execSync(`git diff --cached --name-only | sed 's| |\\ |g'`, { encoding: 'utf8' })
		changedFiles = [...committedFiles, ...stagedFiles.trim().split('\n')]
	}
	changedFiles = changedFiles.filter(f => codeFileExt.has(path.extname(f)))
	changedFiles = new Set(changedFiles)

	const specs = opts.specs || glob.sync(`**/test/*.spec.*s`, { cwd: dirname, ignore })

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
			// console.log(50, {truncatedFilename}, `${truncatedFilename}.unit.spec`)
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

export function emitRelevantSpecCovDetails({ workspace, relevantSpecs, reportDir, testedSpecs }) {
	const specsExtractsDir = path.join(gitProjectRoot, `public/coverage/specs`)
	const wsSpecsExtractsDir = `${specsExtractsDir}/${workspace}`
	//fs.rmSync(wsSpecsExtractsDir, {force: true, recursive: true})
	if (!fs.existsSync(wsSpecsExtractsDir)) fs.mkdirSync(wsSpecsExtractsDir, { force: true, recursive: true })

	if (!relevantSpecs.matched.length) return
	fs.cpSync(reportDir, wsSpecsExtractsDir, { recursive: true })

	const detailedMd = fs.readFileSync(path.join(reportDir, 'coverage-details.md'), { encoding: 'utf8' })
	const detailedLines = detailedMd.split('\n') //; console.log(20, detailedLines)
	// key: comma-separated spec names used for testing
	// value: string filenames that were tested by the specs in key
	const relevantLines = new Map()
	for (const [file, specs] of Object.entries(relevantSpecs.matchedByFile)) {
		if (!specs.length) continue
		const line = detailedLines.find(l => l.includes(file) && (!testedSpecs || specs.find(s => testedSpecs.includes(s))))
		if (line) {
			const key = specs.join(', ')
			if (!relevantLines.has(key)) relevantLines.set(key, new Set())
			relevantLines.get(key).add(line)
		}
		// const coverageHtml = `${reportDir}/${file}.html`
		// if (fs.existsSync(coverageHtml)) {
		// 	const extractsDirname = path.dirname(file)
		// 	const destExtractsDir = path.join(wsSpecsExtractsDir, extractsDirname)
		// 	const filename = path.basename(coverageHtml)
		// 	fs.mkdirSync(destExtractsDir, {force: true, recursive: true}); console.log(132, fs.existsSync(coverageHtml), fs.existsSync(destExtractsDir), `${destExtractsDir}/${file}.html`, fs.existsSync(`${destExtractsDir}/${file}.html`))
		// 	fs.copyFileSync(coverageHtml, `${destExtractsDir}/${filename}`)
		// }
	}

	if (relevantLines.size) {
		console.log(`## Relevant ${workspace} spec coverage`)
		for (const [key, files] of relevantLines) {
			console.log('\n### Tested by: ', key)
			console.log(detailedLines[0])
			console.log(detailedLines[1])
			for (const f of files) {
				console.log(detailedLines.find(l => l.includes(f)))
			}
		}
		console.log('\n')
	}
}
