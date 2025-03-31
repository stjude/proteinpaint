import { getClosestSpec } from '../closestSpec.js'
import { runRelevantSpecs } from '../runRelevantSpecs.js'
import path from 'path'
import tape from 'tape'
import fs from 'fs'
import { execSync } from 'child_process'

const dirname = path.join(import.meta.dirname, '../..')
const relevantSubdirs = ['src']

if (process.argv.includes('-p')) {
	const opts = {
		workspace: 'augen',
		specs: getRelevantAugenSpecs(),
		dirname
	}
	runRelevantSpecs(opts)
}

export function getRelevantAugenSpecs() {
	const opts = {
		// changedFiles: ['tvs.js', 'tvs.categorical.js', 'tvs.numeric.js', 'FilterPrompt.js'].map(f => `client/filter/${f}`),
		// changedFiles: ['handlers/snp.ts'].map(f => `client/termsetting/${f}`)
		ignore: ['src/toyApp']
	}
	return getClosestSpec(dirname, relevantSubdirs, opts)
}
