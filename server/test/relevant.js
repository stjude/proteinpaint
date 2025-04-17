import { runRelevantSpecs } from '@sjcrh/augen/dev'
import { getRelevantServerSpecs } from './closestSpec.js'
import path from 'path'

const opts = {
	workspace: 'server',
	specs: getRelevantServerSpecs(),
	dirname: path.join(import.meta.dirname, '..')
}

runRelevantSpecs(opts)
