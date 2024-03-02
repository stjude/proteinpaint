////////////////////////////////////
//
//  shared between client and server
//
////////////////////////////////////

import * as common from './common.js'
import * as bulk from './bulk.js'

export function parseheader(line, flag) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid header line for truncation'
	const htry = (...lst) => {
		for (const e of lst) {
			const j = header.indexOf(e)
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
	let hasrnapos = false
	i = htry('rnaposition')
	if (i != -1) {
		header[i] = 'rnaposition'
		hasrnapos = true
	}
	i = htry('losstype')
	if (i == -1) return 'lossType missing from header'
	header[i] = 'losstype'
	let hasgenomic = false
	i = htry('chromosome', 'chr')
	if (i != -1) {
		header[i] = 'chr'
		i = htry('start', 'start_position', 'wu_hg19_pos', 'chr_position', 'position')
		if (i == -1) {
			return 'genomic position missing from header'
		}
		header[i] = 'pos'
		hasgenomic = true
	}
	if (!hasrnapos && !hasgenomic) {
		return 'neither rnaposition nor genomic position is given'
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
	flag.truncation.header = header
	flag.truncation.loaded = true
	return false
}

export function parseline(i, line, flag) {
	if (line == '' || line[0] == '#') return
	const lst = line.split('\t')
	const m = {}
	for (let j = 0; j < flag.truncation.header.length; j++) {
		m[flag.truncation.header[j]] = lst[j]
	}
	if (!m.gene) {
		flag.truncation.badlines.push([i, 'missing gene', lst])
		return
	}
	if (m.rnaposition) {
		const v = Number.parseInt(m.rnaposition)
		if (Number.isNaN(v) || v < 0) {
			flag.truncation.badlines.push([i, 'invalid rnaPosition value', lst])
			return
		}
		m.rnaposition = v
	}
	if (m.pos) {
		const v = Number.parseInt(m.pos)
		if (Number.isNaN(v) || v < 0) {
			flag.truncation.badlines.push([i, 'invalid genomic position', lst])
			return
		}
		m.pos = v
	}
	if (!m.losstype) {
		flag.truncation.badlines.push([i, 'missing lossType value', lst])
		return
	}
	if (m.losstype != 'n' && m.losstype != 'c') {
		flag.truncation.badlines.push([i, 'lossType value not "n" or "c"', lst])
		return
	}
	if (bulk.parsesample(m, flag, i, lst, flag.truncation.badlines)) {
		return
	}
	if (m.losstype == 'n') {
		m.dt = common.dtnloss
		m.class = common.mclassnloss
		m.mname = 'N-loss'
	} else {
		m.dt = common.dtcloss
		m.class = common.mclasscloss
		m.mname = 'C-loss'
	}
	flag.good++
	const n = flag.geneToUpper ? m.gene.toUpperCase() : m.gene
	if (!(n in flag.data)) {
		flag.data[n] = []
	}
	flag.data[n].push(m)
}
