module.exports = function(common) {
	const label2mclass = new Map()
	for (const c in common.mclass) {
		label2mclass.set(common.mclass[c].label.toUpperCase(), c)
	}

	return {
		samplecount: 195171,
		dsinfo: [
			{
				k: 'Courtesy of',
				v: '<img style="margin-bottom:20px" src=http://cancer.sanger.ac.uk/cancergenome/gfx/logo_cosmic.png>'
			},
			{ k: 'Link', v: '<a href=http://cancer.sanger.ac.uk/cosmic target=_blank>http://cancer.sanger.ac.uk/cosmic</a>' },
			{ k: 'Version', v: '87' },
			{ k: 'Genome', v: 'GRCh37/hg19' },
			{
				k: 'Note',
				v:
					'This data is made available with permission and under <a href=http://cancer.sanger.ac.uk/cosmic/license target=_blank>license</a> from COSMIC.'
			}
		],
		genome: 'hg19',
		color: '#074987',
		cohort: {
			levels: [{ label: 'Primary site', k: 'primarysite' }]
		},
		dbfile: 'anno/db/cosmic.hg19.db',
		stratify: [{ label: 'tissue type', bycohort: true }],
		queries: [
			{
				name: 'cosmic snv/indel',
				genemcount: {
					query: n => {
						return ['select annovar_sj_gene,sample_name,annovar_sj_class from cosmic_hg19 where annovar_sj_gene=?', n]
					},
					summary: (mlst, re) => {
						let gene
						for (const m of mlst) {
							const c = m.annovar_sj_class
							if (!c) continue
							if (c == 'EXON' || c == 'UTR_5' || c == 'INTRON' || c == 'UTR_3' || c == 'UNKNOWN') continue
							gene = m.annovar_sj_gene
							const cc = label2mclass.get(c.toUpperCase())
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
					if (!q.isoform) return [null]
					return [
						`select primary_site,primary_histology,histology_subtype1,histology_subtype2,histology_subtype3,site_subtype1,site_subtype2,site_subtype3,
						annovar_sj_gene,annovar_sj_class,annovar_sj_aachange,annovar_sj_filter_isoform,sample_name,
						chr,position,pmid,
						reference_allele,mutant_allele,mutation_cds,annovar_sj_cdna from cosmic_hg19
						where annovar_sj_filter_isoform=?`,
						q.isoform.toUpperCase()
					]
				},
				tidy: r => {
					const m = {
						dt: common.dtsnvindel,
						origin: 'S', // somatic, hard-coded
						chr: 'chr' + r.chr,
						pos: r.position - 1,
						mname: r.annovar_sj_aachange,
						isoform: r.annovar_sj_filter_isoform,
						mutation_cds: r.annovar_sj_cdna,
						gene: r.annovar_sj_gene,
						ref: r.reference_allele,
						alt: r.mutant_allele,
						pmid: r.pmid,
						sample: r.sample_name,
						/*
						sj_diagnosis:r.sj_diagnosis,
						sj_subtype:r.sj_subtype,
						sj_subgroup:r.sj_subgroup,
						*/
						primaryhistology: r.primary_histology,
						primarysite: r.primary_site,
						histologysubtype1: r.histology_subtype1,
						histologysubtype2: r.histology_subtype2 == 'NS' ? null : r.histology_subtype2,
						histologysubtype3: r.histology_subtype3 == 'NS' ? null : r.histology_subtype3,
						sitesubtype1: r.site_subtype1,
						sitesubtype2: r.site_subtype2 == 'NS' ? null : r.site_subtype2,
						sitesubtype3: r.site_subtype3 == 'NS' ? null : r.site_subtype3
					}
					const c = r.annovar_sj_class
					if (c && label2mclass.has(c.toUpperCase())) {
						m.class = label2mclass.get(c.toUpperCase())
					} else {
						m.class = common.mclassnonstandard
					}
					return m
				}
			},
			{
				name: 'cosmic fusion',
				dt: common.dtfusionrna,
				genemcount: {
					query: n => {
						return [
							'select genes,sample_name from cosmic_fusion where genes like ? or genes like ?',
							['%' + n, '%' + n + '%']
						]
					},
					summary: (mlst, re) => {
						for (const m of mlst) {
							const genes = m.genes,
								sample = m.sample_name
							if (genes) {
								for (const gene of genes.split(',')) {
									if (!(gene in re)) {
										re[gene] = { class: {}, sample: {}, disease: {}, total: 0 }
									}
									const cc = common.mclassfusionrna
									if (!(cc in re[gene].class)) {
										re[gene].class[cc] = 0
									}
									re[gene].class[cc]++
									if (sample) {
										re[gene].sample[sample] = 1
									}
									re[gene].total++
								}
							}
						}
					}
				},
				makequery: q => {
					if (!q.isoform) return [null]
					const s = q.isoform.toUpperCase()
					const n = s.toLowerCase()
					return ['select * from cosmic_fusion where isoforms like ? or isoforms like ?', ['%' + n, '%' + n + '%']]
				},
				tidy: r => {
					let fusion
					try {
						fusion = JSON.parse(r.fusions)
					} catch (e) {
						console.log('json syntax error in fusion data')
						return
					}
					delete r.genes
					delete r.isoforms
					delete r.fusions
					r.pairlst = fusion
					r.sample = r.sample_name
					delete r.sample_name
					if (r.primarysite == 'NS') r.primarysite = null
					if (r.sitesubtype1 == 'NS') r.sitesubtype1 = null
					if (r.sitesubtype2 == 'NS') r.sitesubtype2 = null
					if (r.sitesubtype3 == 'NS') r.sitesubtype3 = null
					if (r.primaryhistology == 'NS') r.primaryhistology = null
					if (r.histologysubtype1 == 'NS') r.histologysubtype1 = null
					if (r.histologysubtype2 == 'NS') r.histologysubtype2 = null
					if (r.histologysubtype3 == 'NS') r.histologysubtype3 = null
					r.dt = common.dtfusionrna
					r.class = common.mclassfusionrna
					r.origin = common.moriginsomatic
					return r
				}
			}
		]
	}
}
