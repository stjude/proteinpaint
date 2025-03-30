import { getClosestSpec, emitRelevantSpecCovDetails } from '../closestSpec.js'
import path from 'path'
import tape from 'tape'
import fs from 'fs'
import { execSync } from 'child_process'

const dirname = path.join(import.meta.dirname, '../..')
const relevantSubdirs = ['src']
const opts = {
	// changedFiles: ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'FilterPrompt.js'].map(f => `client/filter/${f}`),
	// changedFiles: ['handlers/snp.ts'].map(f => `client/termsetting/${f}`)
	ignore: ['src/toyApp']
}

export const reportDir = path.join(import.meta.dirname, '../../.coverage')

if (process.argv.includes('-p')) runRelevantSpecs()

export function getRelevantAugenSpecs() {
	return getClosestSpec(dirname, relevantSubdirs, opts)
}

async function runRelevantSpecs() {
	const specs = getRelevantAugenSpecs()
	if (!specs.matched.length) {
		if (Object.keys(specs.matchedByFile).length) {
			// TODO: may require a matching spec for all relevant files
			console.log('No matching spec for changed files')
		}
		process.exit(0)
	}

	const c8opts = `--all --src=src --experimental-monocart -r=v8 -r=html -r=json -r=markdown-summary -r=markdown-details -o=./.coverage`

	try {
		const promises = []
		for (const spec of specs.matched) {
			fs.rmSync(reportDir, { force: true, recursive: true })
			const testLog = execSync(`npx c8 ${c8opts} tsx ${path.join(dirname, spec)}`, { encoding: 'utf8' })
			console.log(testLog)
			if (fs.existsSync(reportDir)) {
				emitRelevantSpecCovDetails({ workspace: 'augen', relevantSpecs: specs, reportDir, testedSpecs: [spec] })
			}
		}
		return await Promise.all(promises)
	} catch (e) {
		console.log(`\n!!! augen runRelevantSpecs() error !!!\n`, e, '\n')
		//test.fail(`Error running relevant augen specs`)
		//test.end()
	}
}
