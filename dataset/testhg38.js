const cohorthierarchy = [
	{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full', hide: true },
	{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' }
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
		color: '#545454',
		genome: 'hg38',
		dbfile: 'anno/db/test/hg38test.db',

		sampleselectable: true,

		cohort: {
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
				label: 'Data set',
				get: function(m) {
					return m.dataset_label || ''
				},
				hide: true
			},
			{
				label: 'DNA MAF',
				lst: [
					{
						get: function(m) {
							return m.maf_tumor
						},
						readcountcredibel: 30,
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
			'<p style="font-size:.8em;color: #858585;"><span>DNA MAF: </span><span style="font-weight: bold; color: rgb(255, 77, 77);">Tumor&nbsp;</span><span sty    le="font-weight: bold; color: rgb(77, 77, 255);">Normal&nbsp;</span><svg width="37" height="16" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" fill-opa    city="0.3" shape-rendering="crispEdges"></rect><text x="18" y="9.5" dominant-baseline="middle" font-size="13" text-anchor="middle" fill="#FF471A">0%</text></svg><svg width="37    " height="16" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" fill-opacity="0.3" shape-rendering="crispEdges"></rect><rect width="18" height="15" fill="    #FF471A" shape-rendering="crispEdges"></rect></svg><svg width="37" height="16" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" shape-rendering="crispEdg    es"></rect><text x="18" y="9.5" dominant-baseline="middle" font-size="13" text-anchor="middle" fill="white">100%</text></svg><span>Hover to show read counts&nbsp;&nbsp;</span>    <svg width="36" height="15" style="margin-right: 3px;"><rect width="36" height="15" fill="#FF471A" fill-opacity="0.3" shape-rendering="crispEdges"></rect><rect width="18" heig    ht="15" fill="#FF471A" shape-rendering="crispEdges"></rect><rect width="36" height="15" fill="#545454" fill-opacity="0.3" shape-rendering="crispEdges"></rect></svg><span>&nbsp    ;Darkened if total read count &lt; 30</span></p><p style="color: #858585; font-size: .8em;">Somatic LOH value is computed by <a href="http://www.nature.com/nmeth/journal/v12/n    6/full/nmeth.3394.html" target="_blank">CONSERTING</a>, for diagnosis/germline paired samples.<br>Analysis is only done for autosomes regions with sufficient dbSNP markers. Ye    s for &gt; 0.1, No for ≤ 0.1.</p>',
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
				name: 'snvindel',
				genemcount: {
					query: n => {
						return (
							"select gene_symbol,sample_name,variant_class from snvindel where gene_symbol='" + n + "' collate nocase"
						)
					},
					symmary: (mlst, re) => {
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
						"select snvindel.*, sample_master.* from snvindel left join sample_master on snvindel.sample_name=sample_master.sample_name where snvindel.isoform_accession='" +
						k +
						"' collate nocase"
					)
				},
				tidy: l => {
					const m = {
						dt: common.dtsnvindel,
						sample: l.sample_name,
						chr: l.chromosome,
						pos: l.chr_position - 1,
						mname: l.amino_acid_change,
						isoform: l.isoform_accession,
						dataset_label: l.dataset_label
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
					m.ref = l.REF
					m.alt = l.ALT

					//dna maf
					v1 = l.mutant_reads_in_case
					v2 = l.total_reads_in_case
					if (Number.isFinite(v1) && Number.isFinite(v2) && v2 > 0) {
						m.maf_tumor = { v1: v1, v2: v2, f: v1 / v2 }
					}
					//dna maf 2
					v1 = l.mutant_reads_in_control
					v2 = l.total_reads_in_control
					if (Number.isFinite(v1) && Number.isFinite(v2) && v2 > 0) {
						m.maf_normal = { v1: v1, v2: v2, f: v1 / v2 }
					}
					return m
				}
			},
			{
				name: 'fpkm gene expression',
				isgeneexpression: true,
				makequery: q => {
					const k = q.genename
					if (!k) return null
					return (
						"select fpkm.*, sample_master.* from fpkm left join sample_master on fpkm.sample=sample_master.sample_name where fpkm.gene='" +
						k +
						"' collate nocase"
					)
				},
				tidy: item => {
					const l = item.sample.split('-')
					item.patient = l[0] + '-' + l[1] + '-' + l[2]
					// patient goes with .cohort.key4annotation
					item.sample = item.patient + '-' + l[3]
					return item
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
					attrlst: [{ k: 'sample_name' }]
				}
			}
		]
	}
}
