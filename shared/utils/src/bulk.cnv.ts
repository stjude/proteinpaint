////////////////////////////////////
//
//  shared between client and server
//
////////////////////////////////////

import * as common from './common.js'
import * as bulk from './bulk.js'

export function parseheader(line, flag) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid file header for CNV'
	const htry = (...lst) => {
		for (const i of lst) {
			const j = header.indexOf(i)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('gene')
	if (i == -1) return 'gene missing from header'
	header[i] = 'gene'
	i = htry('cnv')
	if (i == -1) return 'CNV missing from header'
	header[i] = 'cnv'
	i = htry('sample', 'sample_name', 'tumor_sample_barcode')
	if (i != -1) header[i] = 'sample'
	i = htry('patient', 'donor', 'target_case_id')
	if (i != -1) header[i] = 'patient'
	i = htry('disease')
	if (i != -1) header[i] = 'disease'
	i = htry('origin')
	if (i != -1) header[i] = 'origin'
	i = htry('sampletype', 'sample type', 'sample_type')
	if (i != -1) header[i] = 'sampletype'
	flag.cnv.header = header
	flag.cnv.loaded = true
	return false
}

export function parseline(i, line, flag) {
	if (line == '' || line[0] == '#') return
	const lst = line.split('\t')
	const m = {}
	for (let j = 0; j < flag.cnv.header.length; j++) {
		m[flag.cnv.header[j]] = lst[j]
	}
	if (!m.gene) {
		flag.cnv.badlines.push([i, 'missing gene', lst])
		return
	}
	if (!m.cnv) {
		flag.cnv.badlines.push([i, 'missing cnv value', lst])
		return
	}
	const value = m.cnv.toLowerCase()
	switch (value) {
		case 'amplification':
		case 'gain':
			m.class = common.mclasscnvgain
			break
		case 'deletion':
		case 'loss':
			m.class = common.mclasscnvloss
			break
		case 'loh':
			m.class = common.mclasscnvloh
			break
		default:
			flag.cnv.badlines.push([i, 'invalid cnv value: ' + m.cnv, lst])
			m.class = null
	}
	if (!m.class) {
		return
	}
	if (bulk.parsesample(m, flag, i, lst, flag.cnv.badlines)) {
		return
	}
	m.dt = common.dtcnv
	flag.good++
	const n = flag.geneToUpper ? m.gene.toUpperCase() : m.gene
	if (!(n in flag.data)) {
		flag.data[n] = []
	}
	flag.data[n].push(m)
}
