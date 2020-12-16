module.exports = function(common) {
	const label2mclass = {}
	for (const c in common.mclass) {
		label2mclass[common.mclass[c].label.toUpperCase()] = c
	}
	const label2origin = {}
	for (const c in common.morigin) {
		label2origin[common.morigin[c].label.toUpperCase()] = c
	}

	return {
		dbfile: 'VEP2TAB.db',

		dsinfo: [
			{
				k: 'Preparation',
				v:
					'Variants from a VCF file is annotated with VEP, then converted to a tabular format similar to MAF, then load into a sqlite db to be shown here'
			}
		],
		genome: 'hg19',
		color: '#931638',

		queries: [
			{
				name: 'pediatric snv/indel',
				genemcount: {
					query: n => {
						return (
							"select gene_symbol,sample_name,variant_class from snvindel_hg19 where gene_symbol='" +
							n +
							"' collate nocase"
						)
					},
					summary: (mlst, re) => {
						let gene
						for (const m of mlst) {
							const c = m.variant_class
							if (!c) continue
							if (c == 'EXON' || c == 'UTR_5' || c == 'INTRON' || c == 'UTR_3' || c == 'UNKNOWN') continue
							gene = m.gene_symbol
							const cc = label2mclass[c.toUpperCase()]
							if (cc) {
								if (!(cc in re[gene].class)) {
									re[gene].class[cc] = 0
								}
								re[gene].class[cc]++
							}
							const s = m.sample_name
							if (s) {
								re[gene].sample[s] = 1
							}
						}
						if (gene) {
							re[gene].total += mlst.length
						}
					}
				},
				makequery: q => {
					const k = q.isoform
					if (!k) return null
					return "select * from snvindel_hg19 where isoform_accession='" + k + "' collate nocase"
				},
				tidy: l => {
					const m = {
						dt: common.dtsnvindel,
						sample: l.sample_name,
						//specimen:l.sample_disease_phase,
						chr: 'chr' + l.chromosome,
						pos: l.chr_position - 1,
						mname: l.amino_acid_change,
						isoform: l.isoform_accession
						//cdsmutation:l.cdna_coordinate,
						//dataset_label:l.dataset_label,
						//pmid:l.pubmed_id_list,
						//committee_classification:l.committee_classification
					}
					if (l.variant_class) {
						m.class = label2mclass[l.variant_class.toUpperCase()] || common.mclassnonstandard
					} else {
						m.class = common.mclassnonstandard
					}
					const refale = []
					const altale = []
					if (l.allele_1_is_reference == 't') {
						refale.push(l.allele_1)
					} else {
						altale.push(l.allele_1)
					}
					if (l.allele_2_is_reference == 't') {
						refale.push(l.allele_2)
					} else {
						altale.push(l.allele_2)
					}
					m.ref = refale.join('/')
					m.alt = altale.join('/')

					if (l.variant_origin_pp) {
						m.origin = label2origin[l.variant_origin_pp.toUpperCase()] || common.moriginsomatic
						if (m.origin == common.morigingermline) {
							m.isrim1 = true
							if (l.committee_classification) {
								// pediatric germline only
								if (l.committee_classification == 'LIKELY_PATHOGENIC' || l.committee_classification == 'PATHOGENIC') {
									m.origin = common.morigingermlinepathogenic
								} else {
									m.origin = common.morigingermlinenonpathogenic
								}
							}
						} else if (m.origin == common.moriginrelapse) {
							m.isrim2 = true
						}
					} else {
						m.origin = common.moriginsomatic
					}

					//m.origin_type=l.variant_origin_pp

					// rna maf
					/*
					let v1=l.allele_1_signal_rna
					let v2=l.allele_2_signal_rna
					if(Number.isFinite(v1) && Number.isFinite(v2)) {
						if(l.allele_1_is_reference=='t' && v1>0) {
							m.maf_rna={v1:v2,v2:v2+v1,f:v2/(v1+v2)}
						} else if(l.allele_2_is_reference=='t' && v2>0) {
							m.maf_rna={v1:v1,v2:v2+v1,f:v1/(v1+v2)}
						}
					}
					*/

					// dna maf
					let v1 = l.mutant_reads_in_case
					let v2 = l.total_reads_in_case
					if (Number.isFinite(v1) && Number.isFinite(v2) && v2 > 0) {
						m.maf_tumor = { v1: v1, v2: v2, f: v1 / v2 }
					}

					/*
					// dna maf 2
					v1=l.mutant_reads_in_control
					v2=l.total_reads_in_control
					if(Number.isFinite(v1) && Number.isFinite(v2) && v2>0) {
						m.maf_normal={v1:v1,v2:v2, f:v1/v2}
					}
					// loh
					const loh=l[72-1]
					const lohsegmean=l[71-1]
					if(l.loh_seg_mean==undefined) {
						if(l.loh) {
							m.loh='<span style="font-size:80%;color:#858585;">'+l.loh+'</span>'
						}
					} else {
						m.loh=(l.loh ? l.loh+' ' : '') +'<span style="font-size:80%;color:#858585;">'+l.loh_seg_mean+'</span>'
					}
					*/
					return m
				}
			}
		]
	}
}
