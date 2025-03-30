import fs from 'fs'
import path from 'path'
import { getRelevantAugenSpecs, reportDir as augenReportDir } from '../augen/src/test/relevant.js'
// import { getRelevantClientSpecs } from '../client/test/closestSpec.js'
// import { getRelevantServerSpecs } from '../server/test/closestSpec.js'

// const clientSpecs = getRelevantClientSpecs()
// if (clientSpecs.numIntegration) console.log(true)
// else {
// 	const serverSpecs = getRelevantServerSpecs()
// 	// server named as '*integration.spec.*' will indicate backend test that require R, Rust, Python,
// 	// so the test environment must have system dependencies for those, such as in a container or dev environment
// 	if (serverSpecs.numIntegration) console.log(true)
// }

const augenSpecs = getRelevantAugenSpecs()
if (augenSpecs.matched.length) {
	const detailedMd = fs.readFileSync(path.join(augenReportDir, 'coverage-details.md'), { encoding: 'utf8' })
	const detailedLines = detailedMd.split('\n') //; console.log(20, detailedLines)
	// key: comma-separated spec names used for testing
	// value: string filenames that were tested by the specs in key
	const relevantLines = new Map()
	for (const [file, specs] of Object.entries(augenSpecs.matchedByFile)) {
		if (!specs.length) continue
		const key = specs.join(', ')
		if (!relevantLines.has(key)) relevantLines.set(key, new Set())
		relevantLines.get(key).add(detailedLines.find(l => l.includes(file)))
	}

	if (relevantLines.size) {
		console.log(`## Relevant augen spec coverage`)
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
