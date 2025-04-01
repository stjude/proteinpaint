import { runRelevantSpecs } from '@sjcrh/augen'
import { getRelevantServerSpecs } from './closestSpec.js'
import path from 'path'

const changedFiles = process.argv[2]?.split(',') || undefined

const opts = {
	workspace: 'server',
	specs: getRelevantServerSpecs({ changedFiles }),
	dirname: path.join(import.meta.dirname, '..')
}
// console.log(opts)

runRelevantSpecs(opts)
