import { runRelevantSpecs } from '@sjcrh/augen/dev'
import { getClosestSharedSpecs } from './closestSpec.js'
import path from 'path'

const opts = {
	workspace: 'shared/utils',
	specs: getClosestSharedSpecs(),
	dirname: path.join(import.meta.dirname, '..')
}

runRelevantSpecs(opts)

// export function getRelevantSharedSpecs() {
// 	return getClosestSharedSpecs()
// }
