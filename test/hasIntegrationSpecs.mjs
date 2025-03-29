import { getBranchClientSpecs } from '../client/test/closestSpec.js'
import { getBranchServerSpecs } from '../server/test/closestSpec.js'

const clientSpecs = getBranchClientSpecs()
if (clientSpecs.numIntegration) console.log(true)
else {
	const serverSpecs = getBranchServerSpecs()
	// server named as '*integration.spec.*' will indicate backend test that require R, Rust, Python,
	// so the test environment must have system dependencies for those, such as in a container or dev environment
	if (serverSpecs.numIntegration) console.log(true)
}
