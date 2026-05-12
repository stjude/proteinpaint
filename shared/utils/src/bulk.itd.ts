////////////////////////////////////
//
//  shared between client and server
//
////////////////////////////////////

import * as common from './common.js'
import * as bulk from './bulk.js'

export function parseheader(line, flag) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid header line for ITD'
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
	i = htry(
		'annovar_isoform',
		'mrna_accession',
		'mrna accession',
		'refseq_mrna_id',
		'annovar_sj_filter_isoform',
		'refseq',
		'isoform'
	)
	if (i == -1) return 'isoform missing from header'
	header[i] = 'isoform'
	i = htry('rnaposition')
	if (i != -1) {
		header[i] = 'rnaposition'
		i = htry('rnaduplength')
		if (i == -1) return 'rnaduplength is required when rnaposition is present'
		header[i] = 'rnaduplength'
	}
	i = htry('chromosome', 'chr')
	if (i != -1) {
		header[i] = 'chr'
		i = htry('chr_start')
		if (i == -1) return 'chr_start is required when chr is present'
		header[i] = 'chrpos1'
		i = htry('chr_stop')
		if (i == -1) return 'chr_stop is required when chr is present'
		header[i] = 'chrpos2'
	}

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
	flag.itd.header = header
	flag.itd.loaded = true
	return false
}

export function parseline(i, line, flag) {
	if (line == '' || line[0] == '#') return
	const lst = line.split('\t')
	const m = {}
	for (let j = 0; j < flag.itd.header.length; j++) {
		if (lst[j] == undefined) break
		m[flag.itd.header[j]] = lst[j]
	}
	if (!m.gene) {
		flag.itd.badlines.push([i, 'missing gene', lst])
		return
	}
	if (m.rnaposition) {
		let v = Number.parseInt(m.rnaposition)
		if (Number.isNaN(v) || v < 0) {
			flag.itd.badlines.push([i, 'invalid rnaPosition value', lst])
			return
		}
		m.rnaposition = v
		if (!m.rnaduplength) {
			flag.itd.badlines.push([i, 'missing rnaDuplength value', lst])
			return
		}
		v = Number.parseInt(m.rnaduplength)
		if (Number.isNaN(v) || v < 0) {
			flag.itd.badlines.push([i, 'invalid rnaDuplength value', lst])
			return
		}
		m.rnaduplength = v
	}
	if (m.chr) {
		let v = Number.parseInt(m.chrpos1)
		if (Number.isNaN(v) || v < 0) {
			flag.itd.badlines.push([i, 'invalid chr_start value', lst])
			return
		}
		m.chrpos1 = v
		v = Number.parseInt(m.chrpos2)
		if (Number.isNaN(v) || v < 0) {
			flag.itd.badlines.push([i, 'invalid chr_stop value', lst])
			return
		}
		m.chrpos2 = v
	}
	if (bulk.parsesample(m, flag, i, lst, flag.itd.badlines)) {
		return
	}
	m.dt = common.dtitd
	m.class = common.mclassitd
	m.mname = 'ITD'
	flag.good++
	var n = flag.geneToUpper ? m.gene.toUpperCase() : m.gene
	if (!(n in flag.data)) {
		flag.data[n] = []
	}
	flag.data[n].push(m)
}
