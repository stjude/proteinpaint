#!/usr/bin/env node
import serverconfig from '../../server/src/serverconfig.js'

process.chdir('../server')

if (!serverconfig.ignoreTermdbTest) {
	const getTermdbTest = d => d.name == 'TermdbTest'
	const termdbTest = serverconfig.genomes?.find(g => g.name.includes('hg38') && g.datasets.find(getTermdbTest))
	if (!termdbTest) {
		throw 'Missing TermdbTest dataset entry in serverconfig.json'
	}
}
