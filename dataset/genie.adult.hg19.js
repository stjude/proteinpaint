module.exports = function(common) {
	const label2mclass = new Map()
	for (const c in common.mclass) {
		label2mclass.set(common.mclass[c].label.toUpperCase(), c)
	}

	return {
		samplecount: 18966,
		dsinfo: [
			{
				k: 'Courtesy of',
				v: '<img style="width:400px" src=http://www.aacr.org/PublishingImages/ProjectGENIE_Banner_611.jpg>'
			},
			{
				k: 'Link',
				v:
					'<a href=http://www.aacr.org/Research/Research/Pages/aacr-project-genie.aspx target=_blank>www.aacr.org/genie</a>'
			},
			{ k: 'Version', v: '1.0' },
			{ k: 'Genome', v: 'GRCh37/hg19' }
		],
		genome: 'hg19',
		color: '#074987',
		dbfile: 'anno/db/genie.adult.hg19.db',
		cohort: {
			levels: [{ label: 'Cancer', k: 'CANCER_TYPE' }, { label: 'Subtype', k: 'CANCER_TYPE_DETAILED' }]
		},
		stratify: [
			{
				label: 'cancer',
				bycohort: true
			},
			{
				label: 'center',
				attr1: {
					label: 'Center',
					k: 'CENTER'
				}
			}
		],
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
					return m.SAMPLE_TYPE || ''
				},
				label: 'Specimen'
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
			},
			{
				get: function(m) {
					return m.AGE_AT_SEQ_REPORT || ''
				},
				label: 'Age_at_seq_report'
			},
			{
				get: function(m) {
					return m.CENTER || ''
				},
				label: 'Center'
			},
			{
				get: function(m) {
					return m.ETHNICITY || ''
				},
				label: 'Ethnicity'
			},
			{
				get: function(m) {
					return m.ONCOTREE_CODE || ''
				},
				label: 'ONCOTREE_CODE'
			},
			{
				get: function(m) {
					return m.PRIMARY_RACE || ''
				},
				label: 'Primary race'
			},
			{
				get: function(m) {
					return m.SEQ_ASSAY_ID || ''
				},
				label: 'Seq_assay_id'
			},
			{
				get: function(m) {
					return m.SEX || ''
				},
				label: 'Sex'
			}
		],
		queries: [
			{
				name: 'genie snvindel',
				genemcount: {
					query: n => {
						return "select gene,SAMPLE_ID,mclass from data where gene='" + n + "'"
					},
					summary: (mlst, re) => {
						let gene
						for (const m of mlst) {
							const c = m.mclass
							if (!c) continue
							if (c == 'EXON' || c == 'UTR_5' || c == 'INTRON' || c == 'UTR_3' || c == 'UNKNOWN') continue
							gene = m.gene
							const cc = label2mclass.get(c.toUpperCase())
							if (cc) {
								if (!(cc in re[gene].class)) {
									re[gene].class[cc] = 0
								}
								re[gene].class[cc]++
							}
							const s = m.SAMPLE_ID
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
					return "select * from data where isoform='" + k.toUpperCase() + "'"
				},
				tidy: m => {
					m.dt = common.dtsnvindel
					m.origin = 'S' // somatic, hard-coded
					m.sample = m.SAMPLE_ID
					delete m.SAMPLE_ID
					const c = m.mclass
					if (c && label2mclass.has(c.toUpperCase())) {
						m.class = label2mclass.get(c.toUpperCase())
					} else {
						m.class = common.mclassnonstandard
					}
					delete m.mclass
					if (m.tumortotal) {
						const v2 = Number.parseInt(m.tumortotal)
						const v1 = Number.parseInt(m.tumormut)
						if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
							m.maf_tumor = { v1: v1, v2: v2, f: v1 / v2 }
						}
					}
					delete m.tumortotal
					delete m.tumormut
					if (m.normaltotal) {
						const v2 = Number.parseInt(m.normaltotal)
						const v1 = Number.parseInt(m.normalmut)
						if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
							m.maf_normal = { v1: v1, v2: v2, f: v1 / v2 }
						}
					}
					delete m.normaltotal
					delete m.normalmut
					return m
				}
			}
		]
	}
}
