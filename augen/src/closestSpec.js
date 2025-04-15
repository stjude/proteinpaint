import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const gitProjectRoot = path.join(import.meta.dirname, '../..') // execSync(`git rev-parse --show-toplevel`, { encoding: 'utf8' }).trim()
export const publicSpecsDir = path.join(gitProjectRoot, 'public/coverage/specs')

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

export const specsExtractsDir = path.join(gitProjectRoot, `public/coverage/specs`)

export function emitRelevantSpecCovDetails({ workspace, relevantSpecs, reportDir, testedSpecs, specPattern }) {
	const wsSpecsExtractsDir = `${specsExtractsDir}/${workspace}`
	//fs.rmSync(wsSpecsExtractsDir, {force: true, recursive: true})
	if (!fs.existsSync(wsSpecsExtractsDir)) fs.mkdirSync(wsSpecsExtractsDir, { force: true, recursive: true })

	if (!relevantSpecs.matched.length) return
	const reportSrc = fs.existsSync(`${reportDir}/${workspace}`) ? workspace : 'root'
	const srcDir = path.join(wsSpecsExtractsDir, reportSrc)
	if (!fs.existsSync(srcDir)) {
		fs.cpSync(reportDir, wsSpecsExtractsDir, { recursive: true })
		// the copied src dir applies only to a specific spec run,
		// must replace with only relevant html
		fs.rmSync(srcDir, { force: true, recursive: true })
		fs.mkdirSync(srcDir, { force: true, recursive: true })
	}

	const detailedMd = fs.readFileSync(path.join(reportDir, 'coverage-details.md'), { encoding: 'utf8' })
	const detailedLines = detailedMd.split('\n')
	// key: comma-separated spec names used for testing
	// value: string filenames that were tested by the specs in key
	const relevantLines = new Map()
	// key: filename of source-code or file name
	// value: the public URL filepath to the file's line-by-line coverage html
	const targetFiles = new Map()
	for (const [file, specs] of Object.entries(relevantSpecs.matchedByFile)) {
		if (!specs.length) continue
		const line = detailedLines.find(l => l.includes(file) && (!testedSpecs || specs.find(s => testedSpecs.includes(s))))
		if (line) {
			const key = specs.join(', ').trim()
			if (!relevantLines.has(key)) relevantLines.set(key, new Set())
			relevantLines.get(key).add(line)
			let srcFile = `${reportDir}/${reportSrc}/${file}.html`
			let targetFile
			if (fs.existsSync(srcFile)) {
				targetFile = `${wsSpecsExtractsDir}/${reportSrc}/${file}.html`
			} else {
				srcFile = `${reportDir}/${file}.html`
				if (fs.existsSync(srcFile)) {
					targetFile = `${wsSpecsExtractsDir}/${file}.html`
				} else {
					targetFile = ''
					const fname = path.basename(file)
					const filePathSegments = file.split('/').slice(0, -1)
					let subpath = ''
					while (filePathSegments.length) {
						subpath += filePathSegments.pop()
						srcFile = `${reportDir}/${subpath}/${fname}.html`
						if (fs.existsSync(srcFile)) {
							targetFile = `${wsSpecsExtractsDir}/${subpath}/${fname}.html`
							break
						} else {
							subpath += '/'
						}
					}
					if (!targetFile) continue
				}
			}

			const targetDir = path.dirname(targetFile)
			if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
			fs.copyFileSync(srcFile, targetFile)
			targetFiles.set(file, targetFile.replace(publicSpecsDir + '/', ''))
		}
	}

	if (relevantLines.size) {
		const branch = execSync(`git rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }).trim()
		const title = `Relevant coverage for updated ${workspace} code`
		console.log(`## ${title}`)
		const markdown = []
		const html = []
		const colNames = detailedLines[0][0] === '|' ? detailedLines[0] : detailedLines[1]
		const hline = detailedLines[0][0] === '|' ? detailedLines[1] : detailedLines[2]

		for (const [key, lines] of relevantLines) {
			const runCode = !specPattern ? key : `<a href='http://localhost:3000/testrun.html?${specPattern}'>${key}</a>`
			const testedBy = `Tested by: ${runCode.trim()}`
			markdown.push(`\n### ${testedBy}`)
			const info = `<span style='color: #aaa; font-weight: 300'>, branch='${branch}' ${getMonthDayTime()}</span>`
			html.push(`<h3>${testedBy}${info}</h3>`, `\n<table>`)
			markdown.push(colNames, hline)
			html.push(
				`<thead>`,
				`<tr>`,
				...colNames
					.split('|')
					.slice(1, -1)
					.map(colname => `<th>${colname.trim()}</th>`),
				`</tr>`,
				`</thead>`
			)
			const rows = []
			for (const line of lines) {
				markdown.push(line)
				const cells = line.split('|').slice(1, -1)
				const file = cells[0].trim().split(' ').pop().trim()
				const targetKey = file.replace(workspace + '/', '')

				cells[0] = cells[0].replace(
					file,
					`<a href='http://localhost:3000/coverage/specs/${targetFiles.get(targetKey)}'>${file}</a>`
				)
				rows.push(`<tr>`, ...cells.map(val => `<td>${val.trim()}</td>`), `</tr>`)
			}
			html.push(`<tbody>`, ...rows, `</tbody>`, `</table>\n`)
		}
		const fullMarkdown = markdown.join('\n')
		console.log(fullMarkdown, '\n')
		return {
			title,
			markdown: fullMarkdown,
			html: html.join('\n')
		}
	}
}

function getMonthDayTime() {
	const d = new Date()
	const [month, day, hh, mm, ss] = [d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map(
		t => t.toString().padStart(2, '0')
	)

	return `${month}/${day} ${hh}:${mm}:${ss}`
}
