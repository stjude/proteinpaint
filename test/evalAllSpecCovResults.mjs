import { evalSpecCovResults, publicSpecsDir } from '@sjcrh/augen/dev'
import path from 'path'
import fs from 'fs'

const workspaces = ['client', 'server', 'shared/utils', 'augen']

const failedTextsFile = path.join(publicSpecsDir, 'failedTexts.txt')

if (process.argv[2]) evalAllSpecCovResults(Number(process.argv[2]))

export async function evalAllSpecCovResults(errorCode = 0) {
	const failures = []
	const relevantWs = []
	const failedTexts = []

	if (fs.existsSync(failedTextsFile)) fs.rmSync(failedTextsFile, { force: true })

	for (const workspace of workspaces) {
		const result = await evalSpecCovResults({ workspace })
		if (result.workspace) relevantWs.push(result.workspace)
		if (!result.ok) {
			// evalSpecCovResults uses console.log() to display errors
			// console.log(`\n!!! ${workspace} failed spec coverage !!!`)
			// console.log(result.failedCoverage, '\n')
			failures.push(result)
			if (result.failedCoverage) {
				const text = []
				for (const [file, cov] of Object.entries(result.failedCoverage)) {
					if (cov.lowestPct?.diff < 0) text.push(`${file} lowestPct:` + JSON.stringify(cov.lowestPct))
					if (cov.averagePct?.diff < 0) text.push(`${file} averagePct:` + JSON.stringify(cov.averagePct))
				}
				if (text.length) failedTexts.push(workspace, text.join('\n'))
			}
		}
	}
	if (failedTexts.length) {
		fs.writeFileSync(failedTextsFile, failedTexts.join('\n'))
	}
	if (errorCode) {
		if (failures.length) process.exit(failures.length ? errorCode : 0)
	}
	return { failures, workspaces: relevantWs }
}
