const cohorthierarchy = [
	{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full', hide: true },
	{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
	{ k: 'diagnosis_subtype_short', label: 'Subtype', full: 'diagnosis_subtype_full' },
	{ k: 'diagnosis_subgroup_short', label: 'Subgroup', full: 'diagnosis_subgroup_full', hide: true }
]

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
		dbfile: 'anno/db/pediatric.hg19.demo.db',

		sampleselectable: true,
		name2logo: {
			DKFZ: { src: 'http://www.nature.com/natureconferences/njce2012/images/exhibitor/dkfz.jpg', width: 60 }
		},
		dsinfo: [
			{
				k: 'Data source',
				v:
					'<ol style="margin:0px;padding-left:20px;"><li>PCGP <span style="font-size:80%;color:#858585">St. Jude - WashU Pediatric Cancer Genome Project</span></li><li>TARGET <span style="font-size:80%;color:#858585">Therapeutically Applicable Research To Generate Effective Treatments</span></li><li>SCMC <span style="font-size:80%;color:#858585">Shanghai Children\'s Medical Center pediatric ALL project</span></li><li>UTSMC <span style="font-size:80%;color:#858585">UT Southwestern Medical Center Wilms\' tumor study</span></li><li>DKFZ <span style="font-size:80%;color:#858585">German Cancer Research Center Wilms\' tumor study</span></li></ol>'
			},
			{
				k: 'Data type',
				v:
					'<ol style="margin:0px;padding-left:20px;"><li>Point mutation</li><li>Fusion transcript from RNA-seq (PCGP)</li><li>Gene-level expression from RNA-seq (PCGP)</li></ol>'
			},
			{ k: 'Point mutation annotation', v: 'On RefSeq genes by in-house modified Annovar' },
			{ k: 'Fusion transcript detection', v: 'CICERO' },
			{ k: 'Last updated', v: 'August 2016' }
		],
		genome: 'hg19',
		color: '#931638',
		cohort: {
			// both client and server
			levels: cohorthierarchy,
			fromdb: {
				sql: 'select * from sample_master'
			},
			fbarfg: '#9F80FF',
			fbarbg: '#ECE5FF'
		},
		// hard-coded attributes
		// convert to tk.snvindelattr in run time
		snvindel_attributes: [
			{
				get: function(m) {
					return m.mname || ''
				},
				label: 'Mutation'
			},
			{
				get: function(m) {
					return m.sample
				},
				label: 'Sample',
				sort: true,
				descend: true
			},
			{
				get: function(m) {
					return m.specimen || ''
				},
				label: 'Specimen',
				hide: true
			},
			{
				label: 'Genome pos.',
				hide: true,
				get: function(m) {
					if (m.chr && m.pos) return m.chr + ':' + (m.pos + 1)
					return null
				}
			},
			{
				label: 'Allele',
				lst: [
					{
						get: function(m) {
							return m.ref || ''
						},
						label: 'Ref',
						valuecenter: true
					},
					{
						get: function(m) {
							return m.alt || ''
						},
						label: 'Alt',
						valuecenter: true
					}
				]
			},
			{
				label: 'Mut. Origin',
				get: function(m) {
					return m.origin_type || ''
				}
			},
			{
				label: 'Data set',
				get: function(m) {
					return m.dataset_label || ''
				},
				hide: true
			},
			{
				label: 'Committee classification',
				get: function(m) {
					return m.committee_classification || ''
				},
				hide: true
			},
			{
				label: 'PubMed',
				get: function(m) {
					if (!m.pmid) return ''
					var out = []
					m.pmid.split(',').forEach(function(i) {
						if (i == '') return
						var j = Number.parseInt(i)
						if (Number.isNaN(j)) {
							out.push(i)
							return
						}
						out.push('<a target=_blank href=http://www.ncbi.nlm.nih.gov/pubmed/' + i + '>' + i + '</a>')
					})
					return out.join(' ')
				}
			},
			{
				label: 'Somatic LOH',
				get: function(m) {
					return m.loh || ''
				}
			},
			{
				label: 'DNA MAF',
				lst: [
					{
						get: function(m) {
							return m.maf_tumor
						},
						readcountcredible: 30,
						ismaf: true,
						width: 40,
						height: 12,
						label: 'Tumor',
						fill: '#ff4d4d',
						fillbg: '#ffcccc'
					},
					{
						get: function(m) {
							return m.maf_normal
						},
						readcountcredible: 30,
						ismaf: true,
						width: 40,
						height: 12,
						label: 'Normal',
						fill: '#4d4dff',
						fillbg: '#ccccff'
					}
				]
			}
		],
		snvindel_legend:
			'<p style="font-size:.8em;color: #858585;"><span>DNA MAF: </span><span style="font-weight: bold; color: rgb(255, 77, 77);">Tumor&nbsp;</span><span style="font-weight: bold; color: rgb(77, 77, 255);">Normal&nbsp;</span><svg width="37" height="16" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" fill-opacity="0.3" shape-rendering="crispEdges"></rect><text x="18" y="9.5" dominant-baseline="middle" font-size="13" text-anchor="middle" fill="#FF471A">0%</text></svg><svg width="37" height="16" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" fill-opacity="0.3" shape-rendering="crispEdges"></rect><rect width="18" height="15" fill="#FF471A" shape-rendering="crispEdges"></rect></svg><svg width="37" height="16" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" shape-rendering="crispEdges"></rect><text x="18" y="9.5" dominant-baseline="middle" font-size="13" text-anchor="middle" fill="white">100%</text></svg><span>Hover to show read counts&nbsp;&nbsp;</span><svg width="36" height="15" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" fill-opacity="0.3" shape-rendering="crispEdges"></rect><rect width="18" height="15" fill="#FF471A" shape-rendering="crispEdges"></rect><rect width="36" height="15" fill="#545454" fill-opacity="0.3" shape-rendering="crispEdges"></rect></svg><span>&nbsp;Darkened if total read count &lt; 30</span></p><p style="color: #858585; font-size: .8em;">Somatic LOH value is computed by <a href="http://www.nature.com/nmeth/journal/v12/n6/full/nmeth.3394.html" target="_blank">CONSERTING</a>, for diagnosis/germline paired samples.<br>Analysis is only done for autosomes regions with sufficient dbSNP markers. Yes for &gt; 0.1, No for ≤ 0.1.</p>',
		stratify: [
			{
				label: 'cancer subtype',
				bycohort: true
			},
			{
				label: 'dataset',
				attr1: {
					label: 'Dataset',
					k: 'dataset_label'
				}
			}
		],

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
					return (
						"select snvindel_hg19.*, sample_master.* from snvindel_hg19 left join sample_master on snvindel_hg19.sample_name=sample_master.sample_name where snvindel_hg19.isoform_accession='" +
						k +
						"' collate nocase"
					)
				},
				tidy: l => {
					const m = {
						dt: common.dtsnvindel,
						sample: l.sample_name,
						specimen: l.sample_disease_phase,
						chr: 'chr' + l.chromosome,
						pos: l.chr_position - 1,
						mname: l.amino_acid_change,
						isoform: l.isoform_accession,
						//cdsmutation:l.cdna_coordinate,
						dataset_label: l.dataset_label,
						pmid: l.pubmed_id_list,
						committee_classification: l.committee_classification
					}
					for (const L of cohorthierarchy) {
						m[L.k] = l[L.k]
						m[L.full] = l[L.full]
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
					m.origin_type = l.variant_origin_pp
					// rna maf
					let v1 = l.allele_1_signal_rna
					let v2 = l.allele_2_signal_rna
					if (Number.isFinite(v1) && Number.isFinite(v2)) {
						if (l.allele_1_is_reference == 't' && v1 > 0) {
							m.maf_rna = { v1: v2, v2: v2 + v1, f: v2 / (v1 + v2) }
						} else if (l.allele_2_is_reference == 't' && v2 > 0) {
							m.maf_rna = { v1: v1, v2: v2 + v1, f: v1 / (v1 + v2) }
						}
					}
					// dna maf
					v1 = l.mutant_reads_in_case
					v2 = l.total_reads_in_case
					if (Number.isFinite(v1) && Number.isFinite(v2) && v2 > 0) {
						m.maf_tumor = { v1: v1, v2: v2, f: v1 / v2 }
					}
					// dna maf 2
					v1 = l.mutant_reads_in_control
					v2 = l.total_reads_in_control
					if (Number.isFinite(v1) && Number.isFinite(v2) && v2 > 0) {
						m.maf_normal = { v1: v1, v2: v2, f: v1 / v2 }
					}
					// loh
					const loh = l[72 - 1]
					const lohsegmean = l[71 - 1]
					if (l.loh_seg_mean == undefined) {
						if (l.loh) {
							m.loh = '<span style="font-size:80%;color:#858585;">' + l.loh + '</span>'
						}
					} else {
						m.loh =
							(l.loh ? l.loh + ' ' : '') + '<span style="font-size:80%;color:#858585;">' + l.loh_seg_mean + '</span>'
					}
					return m
				}
			},

			{
				name: 'pediatric fusion transcript',
				genemcount: {
					query: n => {
						return (
							"select genes,sample_name from rna_fusion where genes like '%" +
							n +
							"' or genes like '%" +
							n +
							",%' collate nocase"
						)
					},
					summary: (mlst, re) => {
						for (const m of mlst) {
							const genes = m.genes,
								sample = m.sample_name
							if (genes) {
								for (const gene of genes.split(',')) {
									if (!(gene in re)) {
										re[gene] = { class: {}, sample: {}, total: 0 }
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
					const s = q.isoform
					if (!s) return null
					return (
						'select e.*,s.* from rna_fusion as e,sample_master as s ' +
						"where (e.isoforms like '%" +
						s.toUpperCase() +
						"' or e.isoforms like '%" +
						s.toUpperCase() +
						",%'" +
						" or e.genes like '%" +
						s.toUpperCase() +
						"' or e.genes like '%" +
						s.toUpperCase() +
						",%')" +
						'and e.sample_name=s.sample_name collate nocase'
					)
				},
				tidy: r => {
					let fusion
					try {
						fusion = JSON.parse(r.fusions)
					} catch (e) {
						console.log('json syntax error in fusion data')
						return null
					}
					const m = {
						sample: r.sample_name,
						pmid: r.pubmed_id_list,
						dataset_label: r.dataset_label
					}
					for (const l of cohorthierarchy) {
						m[l.k] = r[l.k]
						m[l.full] = r[l.full]
					}
					if (Array.isArray(fusion)) {
						m.inframe = true
						m.dt = common.dtfusionrna
						m.class = common.mclassfusionrna
						m.origin = common.moriginsomatic // FIXME may be wrong
						m.pairlst = fusion
					} else {
						m.dt = fusion.typecode
						delete fusion.typecode
						switch (m.dt) {
							case common.dtitd:
								m.class = common.mclassitd
								m.mname = 'ITD'
								break
							case common.dtnloss:
								m.class = common.mclassnloss
								m.mname = 'N-loss'
								break
							case common.dtcloss:
								m.class = common.mclasscloss
								m.mname = 'C-loss'
								break
							case common.dtdel:
								m.class = common.mclassdel
								m.mname = 'Del'
								break
							default:
								m.class = common.mclassnonstandard
								m.mname = 'unknown dt'
								console.log('unknown dt from fusion data: ' + m.dt)
						}
						for (const k in fusion) {
							m[k] = fusion[k]
						}
					}
					return m
				}
			},

			{
				name: 'pediatric sv',
				genemcount: {
					query: n => {
						return (
							"select genes,sample_name from sv where genes like '%" +
							n +
							"' or genes like '%" +
							n +
							",%' collate nocase"
						)
					},
					summary: (mlst, re) => {
						for (const m of mlst) {
							const genes = m.genes,
								sample = m.sample_name
							if (genes) {
								for (const gene of genes.split(',')) {
									if (!(gene in re)) {
										re[gene] = { class: {}, sample: {}, total: 0 }
									}
									const cc = common.mclasssv
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
					const s = q.isoform
					if (!s) return null
					return (
						'select e.*,s.* from sv as e,sample_master as s ' +
						"where (e.isoforms like '%" +
						s.toUpperCase() +
						"' or e.isoforms like '%" +
						s.toUpperCase() +
						",%'" +
						" or e.genes like '%" +
						s.toUpperCase() +
						"' or e.genes like '%" +
						s.toUpperCase() +
						",%')" +
						'and e.sample_name=s.sample_name collate nocase'
					)
				},
				tidy: r => {
					let fusion
					try {
						fusion = JSON.parse(r.sv)
					} catch (e) {
						console.log('json syntax error in fusion data')
						return null
					}
					const m = {
						sample: r.sample_name,
						pmid: r.pubmed_id_list,
						dataset_label: r.dataset_label
					}
					for (const l of cohorthierarchy) {
						m[l.k] = r[l.k]
						m[l.full] = r[l.full]
					}
					if (Array.isArray(fusion)) {
						m.inframe = true
						m.dt = common.dtsv
						m.class = common.mclasssv
						m.origin = common.moriginsomatic // FIXME may be wrong
						m.pairlst = fusion
					} else {
						// FIXME
						m.dt = fusion.typecode
						delete fusion.typecode
						switch (m.dt) {
							case common.dtitd:
								m.class = common.mclassitd
								m.mname = 'ITD'
								break
							case common.dtnloss:
								m.class = common.mclassnloss
								m.mname = 'N-loss'
								break
							case common.dtcloss:
								m.class = common.mclasscloss
								m.mname = 'C-loss'
								break
							case common.dtdel:
								m.class = common.mclassdel
								m.mname = 'Del'
								break
							default:
								m.class = common.mclassnonstandard
								m.mname = 'unknown dt'
								console.log('unknown dt from fusion data: ' + m.dt)
						}
						for (const k in fusion) {
							m[k] = fusion[k]
						}
					}
					return m
				}
			},

			{
				name: 'pediatric fpkm gene expression',
				isgeneexpression: true,
				makequery: q => {
					const k = q.genename
					if (!k) return null
					return (
						"select pcgp_fpkm.*, sample_master.* from pcgp_fpkm left join sample_master on pcgp_fpkm.sample=sample_master.sample_name where pcgp_fpkm.gene='" +
						k +
						"' collate nocase"
					)
				},
				config: {
					// client-side, tk-specific attributes
					gtexlink: true,
					usecohort: true,
					name: 'RNA-seq gene expression',
					sampletype: 'sample',
					datatype: 'FPKM',
					ongene: true,
					scaleminvalue: 0,
					hlcolor: '#f53d00',
					hlcolor2: '#FFBEA8',
					attrlst: [{ k: 'sample_name' }, { k: 'sample_type' }],
					// FIXME bad logic
					// maf means the maf data regarding particular mutations of the same expression profiling assay, is stored in other tables
					// and this maf info will accompany the fpkm data stored in current table
					// otherwise, do not use maf
					maf: {
						// used in mutation table of protein panel
						label: 'MAF',
						get: function(m) {
							switch (m.dt) {
								case common.dtsnvindel:
									return m.maf_rna
								case common.dtfusionrna:
									if (m.pairlst[0] && m.pairlst[0].a && typeof m.pairlst[0].a.ratio == 'number') {
										const lst = m.pairlst.map(function(i) {
											return (
												(i.a.name || '') +
												': ' +
												(typeof i.a.ratio == 'number' ? i.a.ratio : '?') +
												', ' +
												(i.b.name || '') +
												': ' +
												(typeof i.b.ratio == 'number' ? i.b.ratio : '?')
											)
										})
										return lst.join(' ')
									}
									return ''
								case common.dtcloss:
								case common.dtnloss:
									if (m.ratio != undefined) {
										return (
											m.ratio +
											(m.chimericreads ? ' (' + m.chimericreads + '/' + Math.ceil(m.chimericreads / m.ratio) + ')' : '')
										)
									}
									return ''
								case common.dtitd:
									if (m.a && m.b && m.a.ratio && m.b.ratio) {
										return (
											m.a.ratio +
											' (' +
											m.a.chimericreads +
											'/' +
											Math.ceil(m.a.chimericreads / m.a.ratio) +
											'), ' +
											m.b.ratio +
											' (' +
											m.b.chimericreads +
											'/' +
											Math.ceil(m.b.chimericreads / m.b.ratio) +
											')'
										)
									}
									return ''
								default:
									return ''
							}
						},
						readcountcredible: 30
					}
				}
			}
		]
	}
}
