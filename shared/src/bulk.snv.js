///////////////////////////////
//
//  shared between client and server
//
///////////////////////////////

import * as common from './common.js'
import * as bulk from './bulk.js'

export function parseheader(line, flag) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return 'invalid file header for snv/indel'
	const htry = (...args) => {
		for (const s of args) {
			const i = header.indexOf(s)
			if (i != -1) return i
		}
		return -1
	}
	let i = htry('annovar_gene', 'annovar_sj_gene', 'gene', 'genename', 'gene_symbol', 'hugo_symbol')
	if (i == -1) return 'gene missing from header'
	header[i] = 'gene'
	i = htry('annovar_aachange', 'amino_acid_change', 'annovar_sj_aachange', 'aachange', 'protein_change', 'variant')
	if (i == -1) return 'amino_acid_change missing from header'
	header[i] = 'mname'
	i = htry('annovar_class', 'class', 'mclass', 'variant_class', 'variant_classification', 'annovar_sj_class')
	if (i == -1) return 'variant_class missing from header'
	header[i] = 'class'
	i = htry('chromosome', 'chr')
	if (i == -1) return 'chromosome missing from header'
	header[i] = 'chr'
	i = htry('wu_hg19_pos', 'start', 'start_position', 'chr_position', 'position')
	if (i == -1) return 'start missing from header'
	header[i] = 'pos'
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

	// optional
	i = htry('sample', 'sample_name', 'tumor_sample_barcode')
	if (i != -1) header[i] = 'sample'
	i = htry('patient', 'donor', 'target_case_id')
	if (i != -1) header[i] = 'patient'
	i = htry('quantitative_measurements')
	if (i != -1) header[i] = 'qmset'
	// dna maf tumor
	i = htry('mutant_reads_in_case', 'mutant_in_tumor', 'tumor_readcount_alt')
	if (i != -1) header[i] = 'maf_tumor_v1'
	i = htry('total_reads_in_case', 'total_in_tumor', 'tumor_readcount_total')
	if (i != -1) header[i] = 'maf_tumor_v2'
	// dna maf normal
	i = htry('mutant_reads_in_control', 'mutant_in_normal', 'normal_readcount_alt')
	if (i != -1) header[i] = 'maf_normal_v1'
	i = htry('total_reads_in_control', 'total_in_normal', 'normal_readcount_total')
	if (i != -1) header[i] = 'maf_normal_v2'
	// rna maf
	// cdna
	i = htry('cdna_change')
	if (i != -1) header[i] = 'cdna_change'
	i = htry('sampletype', 'sample type', 'sample_type')
	if (i != -1) header[i] = 'sampletype'
	i = htry('origin')
	if (i != -1) header[i] = 'origin'
	i = htry('cancer', 'disease', 'diagnosis')
	if (i != -1) header[i] = 'disease'
	flag.snv.header = header
	flag.snv.loaded = true
	return false
}

export function parseline(linei, line, flag) {
	if (line == '' || line[0] == '#') return
	const lst = line.split('\t')
	const m = {}
	for (let j = 0; j < flag.snv.header.length; j++) {
		if (lst[j] == undefined) break
		m[flag.snv.header[j]] = lst[j]
	}
	if (!m.gene) {
		flag.snv.badlines.push([linei, 'missing gene', lst])
		return
	}
	if (m.gene.toUpperCase() == 'UNKNOWN') {
		flag.snv.badlines.push([linei, 'gene name is UNKNOWN', lst])
		return
	}
	if (!m.isoform) {
		flag.snv.badlines.push([linei, 'missing isoform', lst])
		return
	}
	if (!m.mname) {
		m.mname = m.cdna_change
		if (!m.mname) {
			flag.snv.badlines.push([linei, 'missing amino acid change', lst])
			return
		}
	} else {
		if (m.mname.indexOf('p.') == 0) {
			m.mname = m.mname.replace(/^p\./, '')
		}
	}
	if (!m.class) {
		flag.snv.badlines.push([linei, 'missing mutation class', lst])
		return
	}
	let _c = flag.mclasslabel2key[m.class.toUpperCase()]
	if (_c) {
		m.class = _c
	} else {
		_c = common.mclasstester(m.class)
		if (_c) {
			m.class = _c
		} else {
			flag.snv.badlines.push([linei, 'wrong mutation class: ' + m.class, lst])
			return
		}
	}
	if (bulk.parsesample(m, flag, linei, lst, flag.snv.badlines)) {
		return
	}
	if (!m.chr) {
		flag.snv.badlines.push([linei, 'missing chromosome', lst])
		return
	}
	if (m.chr.toLowerCase().indexOf('chr') != 0) {
		m.chr = 'chr' + m.chr
	}
	if (!m.pos) {
		flag.snv.badlines.push([linei, 'missing chromosome position', lst])
		return
	}
	const v = Number.parseInt(m.pos)
	if (Number.isNaN(v)) {
		flag.snv.badlines.push([linei, 'invalid chromosome position', lst])
		return
	}
	m.pos = v - 1

	if (m.maf_tumor_v2 != undefined && m.maf_tumor_v1 != undefined) {
		if (m.maf_tumor_v2 == '') {
			// no value, do not parse
		} else {
			let v1 = Number.parseInt(m.maf_tumor_v1),
				v2 = Number.parseInt(m.maf_tumor_v2)
			if (Number.isNaN(v1) || Number.isNaN(v2)) {
				flag.snv.badlines.push([linei, 'invalid maf_tumor mutant and/or total read count', lst])
				return
			}
			m.maf_tumor = { f: v1 / v2, v1: v1, v2: v2 }
		}
		delete m.maf_tumor_v1
		delete m.maf_tumor_v2
	}

	if (m.maf_normal_v1 != undefined && m.maf_normal_v2 != undefined) {
		if (m.maf_normal_v2 == '') {
			// no value
		} else {
			let v1 = Number.parseInt(m.maf_normal_v1),
				v2 = Number.parseInt(m.maf_normal_v2)
			if (Number.isNaN(v1) || Number.isNaN(v2)) {
				flag.snv.badlines.push([linei, 'invalid maf_normal mutant and/or total read count', lst])
				return
			}
			m.maf_normal = { f: v1 / v2, v1: v1, v2: v2 }
		}
		delete m.maf_normal_v1
		delete m.maf_normal_v2
	}

	/*
	if(m.qmset) {
		try{
			var v=JSON.parse(m.qmset)
		} catch(e){
			flag.snv.badlines.push([linei,'invalid JSON for quantitative_measurements',lst])
			v=null
		} finally {
			if(v) {
				if(typeof(v)!='object') {
					flag.snv.badlines.push([linei,'value of quantitative_measurements must be an object',lst])
					delete m.qmset
				} else {
					for(var n in v) {
						if(!Array.isArray(v[n])) {
							flag.snv.badlines.push([linei,'quantitative_measurements: "'+n+'" value must be an array',lst])
							delete v[n]
						} else {
							var tmp=[]
							v[n].forEach(function(v2){
								if(typeof(v2)=='number') {
									tmp.push({v:v2})
								} else if(v2.v && typeof(v2.v)=='number') {
									tmp.push(v2)
								}
							})
							if(tmp.length) {
								v[n]=tmp
							} else {
								flag.snv.badlines.push([linei,'quantitative_measurements: no valid value for "'+n+'"',lst])
								delete v[n]
							}
						}
					}
					m.qmset=v
				}
			} else {
				delete m.qmset
			}
		}
	}
	*/
	flag.good++
	// FIXME hard-coded M and S
	if (m.class == 'M') {
		flag.snv.missense++
	} else if (m.class == 'S') {
		flag.snv.silent++
	}
	const n = flag.geneToUpper ? m.gene.toUpperCase() : m.gene
	if (!flag.data[n]) {
		flag.data[n] = []
	}
	m.dt = common.dtsnvindel
	flag.data[n].push(m)
}
