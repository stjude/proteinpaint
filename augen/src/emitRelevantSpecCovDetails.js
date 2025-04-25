import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { gitProjectRoot, publicSpecsDir } from './closestSpec.js'
import { evalSpecCovResults } from './evalSpecCovResults.js'

export const specsExtractsDir = path.join(gitProjectRoot, `public/coverage/specs`)

export async function emitRelevantSpecCovDetails({ workspace, relevantSpecs, reportDir, testedSpecs, specPattern }) {
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

	const jsonFile = `${reportDir}/coverage-summary.json`
	const resultsJson = fs.readFileSync(jsonFile, { encoding: 'utf8' })
	const results = JSON.parse(resultsJson.replaceAll(`"${workspace}/`, `"`))
	const jsonExtract = {}

	let detailedMd = fs.readFileSync(path.join(reportDir, 'coverage-details.md'), { encoding: 'utf8' })
	detailedMd = detailedMd.replaceAll(`"${workspace}/`, `"`)
	const detailedLines = detailedMd.split('\n')
	// key: comma-separated spec names used for testing
	// value: string filenames that were tested by the specs in key
	const relevantLines = new Map()
	// key: filename of source-code or file name
	// value: the public URL filepath to the file's line-by-line coverage html
	const targetFiles = new Map()
	for (const [file, specs] of Object.entries(relevantSpecs.matchedByFile)) {
		if (!specs.length) continue
		// TODO: simplify finding matching html files for relevant specs
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
					if (!targetFile) {
						srcFile = `${reportDir}/${fname}.html`
						if (fs.existsSync(srcFile)) targetFile = `${wsSpecsExtractsDir}/${fname}.html`
						else continue
					}
				}
			}

			const targetDir = path.dirname(targetFile)
			if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
			fs.copyFileSync(srcFile, targetFile)
			targetFiles.set(file, targetFile.replace(publicSpecsDir + '/', ''))
			jsonExtract[file] = results[file]
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
				`<th>Lowest Pct</th>`,
				`<th>Average Pct</th>`,
				`</tr>`,
				`</thead>`
			)
			const rows = []
			for (const _line of lines) {
				const line = _line.replaceAll(workspace + '/', '')
				markdown.push(line)
				const cells = line.split('|').slice(1, -1)
				const file = cells[0]
					.trim()
					.split(' ')
					.pop()
					.trim()
					.replaceAll(workspace + '/', '')
				const targetKey = file.replace(workspace + '/', '')
				const result = await evalSpecCovResults({ workspace, jsonExtract: { [file]: jsonExtract[file] } })
				const { lowestPct, averagePct, failedCoverage } = result.relevantCoverage?.[file]?.lowestPct
					? result.relevantCoverage[file]
					: {
							lowestPct: { curr: 0, prev: 0, diff: 0 },
							averagePct: { curr: 0, prev: 0, diff: 0 }
					  }
				const failColor = `color: #f00`
				const failBg = `background-color: rgba(200, 100, 100, 0.1)`
				const passBg = `background-color: rgba(100, 200, 100, 0.2)`
				const cell0bgStyle = !result.failedCoverage?.[file] ? '' : `style='${failColor}; ${failBg}'`
				const lowestPctColor = lowestPct?.diff >= 0 ? '' : `style='${failColor}'`
				const lowestPctBg = lowestPct?.diff >= 0 ? `style='${passBg}'` : `style='${failBg}'`
				const averagePctColor = averagePct?.diff >= 0 ? '' : `style='${failColor}'`
				const averagePctBg = averagePct?.diff >= 0 ? `style='${passBg}'` : `style='${failBg}'`

				cells[0] = cells[0].replace(
					file,
					`<a href='http://localhost:3000/coverage/specs/${targetFiles.get(targetKey)}'>${file}</a>`
				)
				rows.push(
					`<tr>`,
					...cells.map((val, i) => `<td ${i === 0 ? cell0bgStyle : ''}'>${val.trim().replace(' %', '%')}</td>`),
					`<td ${lowestPctBg}>${lowestPct.curr} - ${lowestPct.prev} = <span ${lowestPctColor}'>${lowestPct.diff.toFixed(
						1
					)}%</span></td>`,
					`<td ${averagePctBg}>${averagePct.curr.toFixed(1)} - ${averagePct.prev.toFixed(
						1
					)} = <span ${averagePctColor}'>${averagePct.diff.toFixed(1)}%</span></td>`,
					`</tr>`
				)
			}
			html.push(`<tbody>`, ...rows, `</tbody>`, `</table>\n`)
		}
		const fullMarkdown = markdown.join('\n')
		console.log(fullMarkdown, '\n')
		return {
			title,
			markdown: fullMarkdown,
			html: html.join('\n'),
			json: jsonExtract
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
