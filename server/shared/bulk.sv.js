import * as bulk from './bulk.js'
import * as common from './common.js'

/////////////////////////////////
//
// client/server shared
//
/////////////////////////////////

// work for both sv/fusion
// must tell if the data is fusion or sv

export function parseheader(line, flag, issv) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid file header for fusions'
	const htry = (...lst) => {
		for (const a of lst) {
			const j = header.indexOf(a)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('gene_a', 'gene1', 'genea')
	if (i == -1) return 'gene_a missing from header'
	header[i] = 'gene1'
	i = htry('gene_b', 'gene2', 'geneb')
	if (i == -1) return 'gene_b missing from header'
	header[i] = 'gene2'
	i = htry('chr_a', 'chr1', 'chra')
	if (i == -1) return 'chr_a missing from header'
	header[i] = 'chr1'
	i = htry('chr_b', 'chr2', 'chrb')
	if (i == -1) return 'chr_b missing from header'
	header[i] = 'chr2'
	i = htry('pos_a', 'position_a', 'position1', 'posa')
	if (i == -1) return 'pos_a missing from header'
	header[i] = 'position1'
	i = htry('pos_b', 'position_b', 'position2', 'posb')
	if (i == -1) return 'pos_b missing from header'
	header[i] = 'position2'
	i = htry('isoform_a', 'refseq_a', 'refseq1', 'isoform1', 'sv_refseqa')
	if (i == -1) return 'isoform_a missing from header'
	header[i] = 'isoform1'
	i = htry('isoform_b', 'refseq_b', 'refseq2', 'isoform2', 'sv_refseqb')
	if (i == -1) return 'isoform_b missing from header'
	header[i] = 'isoform2'
	i = htry('strand_a', 'orta')
	if (i == -1) return 'strand_a missing from header'
	header[i] = 'strand1'
	i = htry('strand_b', 'ortb')
	if (i == -1) return 'strand_b missing from header'
	header[i] = 'strand2'
	// optional
	i = htry('sample', 'sample_name', 'tumor_sample_barcode')
	if (i != -1) header[i] = 'sample'
	i = htry('patient', 'donor', 'target_case_id')
	if (i != -1) header[i] = 'patient'
	i = htry('sampletype', 'sample type', 'sample_type')
	if (i != -1) header[i] = 'sampletype'
	i = htry('disease')
	if (i != -1) header[i] = 'disease'
	i = htry('origin')
	if (i != -1) header[i] = 'origin'
	if (issv) {
		flag.sv.loaded = true
		flag.sv.header = header
	} else {
		flag.fusion.loaded = true
		flag.fusion.header = header
	}
	return false
}

export function parseline(i, line, flag, issv) {
	if (line == '' || line[0] == '#') return
	const lst = line.split('\t')
	const m = {}
	const header = issv ? flag.sv.header : flag.fusion.header
	const badlines = issv ? flag.sv.badlines : flag.fusion.badlines

	for (let j = 0; j < header.length; j++) {
		m[header[j]] = lst[j]
	}
	if (!m.chr1) {
		badlines.push([i, 'missing chr1', lst])
		return
	}
	if (m.chr1.toLowerCase().indexOf('chr') != 0) {
		m.chr1 = 'chr' + m.chr1
	}
	if (!m.chr2) {
		badlines.push([i, 'missing chr2', lst])
		return
	}
	if (m.chr2.toLowerCase().indexOf('chr') != 0) {
		m.chr2 = 'chr' + m.chr2
	}
	let v = m.position1
	if (!v) {
		badlines.push([i, 'missing position1', lst])
		return
	}
	let v2 = Number.parseInt(v)
	if (Number.isNaN(v2) || v2 <= 0) {
		badlines.push([i, 'invalid value for position1', lst])
		return
	}
	m.position1 = v2
	v = m.position2
	if (!v) {
		badlines.push([i, 'missing position2', lst])
		return
	}
	v2 = Number.parseInt(v)
	if (Number.isNaN(v2) || v2 <= 0) {
		badlines.push([i, 'invalid value for position2', lst])
		return
	}
	m.position2 = v2
	if (bulk.parsesample(m, flag, i, lst, badlines)) {
		return
	}
	if (m.isoform1 && m.isoform1.indexOf(',') != -1) {
		const lst2 = m.isoform1.split(',')
		m.isoform1 = undefined
		for (const t of lst2) {
			if (t != '') m.isoform1 = t
		}
	}
	if (m.isoform2 && m.isoform2.indexOf(',') != -1) {
		const lst2 = m.isoform2.split(',')
		m.isoform2 = undefined
		for (const t of lst2) {
			if (t != '') m.isoform2 = t
		}
	}
	if (!m.gene1) {
		m.isoform1 = undefined
	}
	if (!m.gene2) {
		m.isoform2 = undefined
	}
	if (m.gene1) {
		// put data under gene1
		flag.good++
		const m2 = {
			dt: issv ? common.dtsv : common.dtfusionrna,
			class: issv ? common.mclasssv : common.mclassfusionrna,
			isoform: m.isoform1,
			mname: m.gene2 || m.chr2,
			sample: m.sample,
			patient: m.patient,
			sampletype: m.sampletype,
			origin: m.origin,
			disease: m.disease,
			pairlst: [
				{
					a: {
						name: m.gene1,
						isoform: m.isoform1,
						strand: m.strand1,
						chr: m.chr1,
						position: m.position1
					},
					b: {
						name: m.gene2,
						isoform: m.isoform2,
						strand: m.strand2,
						chr: m.chr2,
						position: m.position2
					}
				}
			]
		}
		const n = flag.geneToUpper ? m.gene1.toUpperCase() : m.gene1
		if (!flag.data[n]) {
			flag.data[n] = []
		}
		flag.data[n].push(m2)
	}
	if (m.gene2 && m.gene2 != m.gene1) {
		// put data under gene2
		flag.good++
		const m2 = {
			dt: issv ? common.dtsv : common.dtfusionrna,
			class: issv ? common.mclasssv : common.mclassfusionrna,
			isoform: m.isoform2,
			mname: m.gene1 || m.chr1,
			sample: m.sample,
			patient: m.patient,
			sampletype: m.sampletype,
			origin: m.origin,
			disease: m.disease,
			pairlst: [
				{
					a: {
						name: m.gene1,
						isoform: m.isoform1,
						strand: m.strand1,
						chr: m.chr1,
						position: m.position1
					},
					b: {
						name: m.gene2,
						isoform: m.isoform2,
						strand: m.strand2,
						chr: m.chr2,
						position: m.position2
					}
				}
			]
		}
		const n = flag.geneToUpper ? m.gene2.toUpperCase() : m.gene2
		if (!flag.data[n]) {
			flag.data[n] = []
		}
		flag.data[n].push(m2)
	}
}

export function duplicate(m) {
	const n = {}
	for (const k in m) {
		if (k == 'pairlst') continue
		const v = m[k]
		const type = typeof v
		if (type == 'object') {
			continue
		}
		n[k] = v
	}
	if (m.pairlst) {
		n.pairlst = []
		for (const pair of m.pairlst) {
			const p = {}
			for (const k in pair) {
				if (k == 'a' || k == 'b' || k == 'interstitial') {
					continue
				}
				p[k] = pair[k]
			}
			if (pair.a) {
				p.a = {}
				for (const k in pair.a) {
					const v = pair.a[k]
					if (typeof v == 'object') {
						continue
					}
					p.a[k] = v
				}
			}
			if (pair.b) {
				p.b = {}
				for (const k in pair.b) {
					const v = pair.b[k]
					if (typeof v == 'object') {
						continue
					}
					p.b[k] = v
				}
			}
			if (pair.interstitial) {
				p.interstitial = {}
				for (const k in pair.interstitial) {
					const v = pair.interstitial[k]
					if (typeof v == 'object') {
						continue
					}
					p.interstitial[k] = v
				}
			}
			n.pairlst.push(p)
		}
	}
	return n
}
