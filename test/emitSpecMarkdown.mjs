import fs from 'fs'
import path from 'path'
import { getRelevantAugenSpecs, reportDir as augenReportDir, extractFiles } from '../augen/src/test/relevant.js'
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
	const augenMarkdown = fs.readFileSync(extractFiles.markdown, { encoding: 'utf8' })
	console.log(augenMarkdown)
}
