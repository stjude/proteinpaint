import { getClosestSpec } from '../closestSpec.js'
import path from 'path'
import tape from 'tape'

const dirname = path.join(import.meta.dirname, '../..')
const relevantSubdirs = ['src']
const opts = {
	// changedFiles: ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'FilterPrompt.js'].map(f => `client/filter/${f}`),
	// changedFiles: ['handlers/snp.ts'].map(f => `client/termsetting/${f}`)
	ignore: ['src/toyApp']
}

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

	tape('loading of all import(spec)', async test => {
		try {
			const promises = []
			for (const spec of specs.matched) {
				promises.push(await import(`../../${spec}`))
			}
			return await Promise.all(promises)
			test.end()
		} catch (e) {
			console.log(`\n!!! augen runRelevantSpecs() error !!!\n`, e, '\n')
			test.fail(`Error running relevant augen specs`)
			test.end()
		}
	})
}

export const reportDir = path.join(import.meta.dirname, '../../.coverage')
