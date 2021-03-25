const cohorthierarchy = [
	{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full' },
	{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
	{ k: 'diagnosis_subtype_short', label: 'Subtype', full: 'diagnosis_subtype_full' },
	{ k: 'diagnosis_subgroup_short', label: 'Subgroup', full: 'diagnosis_subgroup_full' }
]

const valuePerSample = {
	key: 'percentage',
	label: 'Percentage',
	cutoffValueLst: [
		{ side: '>', value: 5, label: '>5%' },
		{ side: '>', value: 10, label: '>10%' },
		{ side: '>', value: 20, label: '>20%' },
		{ side: '>', value: 30, label: '>30%' },
		{ side: '>', value: 40, label: '>40%' }
	]
}

const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		genome: 'hg19',
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'files/hg19/tcga/melanoma/tracktable/__table'
		},

		singlesamplemutationjson: {
			file: 'files/hg19/tcga/melanoma/mutationpersample/table'
		},

		/*
            cohort and sample annotation
         */

		cohort: {
			files: [{ file: 'files/hg19/tcga/melanoma/sampletable/sample.table' }],
			samplenamekey: samplenamekey,
			tohash: (item, ds) => {
				const samplename = item[samplenamekey]
				if (!samplename) return console.error(samplenamekey + ' missing from a line: ' + JSON.stringify(item))
				if (ds.cohort.annotation[samplename]) {
					// append info
					for (const k in item) {
						ds.cohort.annotation[samplename][k] = item[k]
					}
				} else {
					// new sample
					ds.cohort.annotation[samplename] = item
				}
			},
			hierarchies: {
				lst: [
					{
						name: 'Cancer',
						levels: cohorthierarchy
					}
				]
			},
			sampleAttribute: {
				attributes: {
					diagnosis_group_short: {
						label: 'Cancer group',
						filter: 1,
						hidden: 1
					},
					diagnosis_short: {
						label: 'Cancer',
						filter: 1
					}
				}
			}
		},

		mutationAttribute: {
			attributes: {
				dna_assay: {
					label: 'DNA assay',
					values: {
						wgs: { name: 'WGS', label: 'Whole-genome sequencing' }
					},
					hidden: 1,
					filter: 1
				},
				vorigin: {
					label: 'Variant origin',
					values: {
						somatic: { name: 'Somatic' },
						germline: { name: 'Germline' }
					},
					filter: 1
				}
			}
		},

		queries: {
			svcnv: {
				name: 'TCGA Melanoma mutation',
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'files/hg19/tcga/melanoma/Melanoma.svcnv.gz',

				// cnv
				valueCutoff: 0.4,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				// loh
				segmeanValueCutoff: 0.1,
				lohLengthUpperLimit: 2000000,

				/*
         		groupsamplebyattr:{
         			attrlst:[
         				{k:'diagnosis_group_short',label:'Group',full:'diagnosis_group_full'},
         				{k:'diagnosis_short',label:'Cancer',full:'diagnosis_full'},
         			],
         			sortgroupby:{
         				key:'diagnosis_group_short',
         				order:['ST','BT','HM']
         			},
         			attrnamespacer:', ',
         		},
                */
				expressionrank_querykey: 'genefpkm',
				vcf_querykey: 'snvindel',

				multihidelabel_vcf: true,
				multihidelabel_fusion: false,
				multihidelabel_sv: true,

				legend_vorigin: {
					key: 'vorigin',
					somatic: 'somatic',
					germline: 'germline'
				}
			},

			snvindel: {
				hideforthemoment: 1,
				name: 'TCGA Melanoma SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'files/hg19/tcga/melanoma/Melanoma.vep.vcf.gz',
						type: 'vcf'
					}
				],
				singlesamples: {
					tablefile: 'files/hg19/tcga/melanoma/split.vcf/table'
				}
			},

			genefpkm: {
				hideforthemoment: 1,
				name: 'TCGA Melanoma RNA-seq gene FPKM',
				isgenenumeric: true,
				file: 'files/hg19/tcga/melanoma/Melanoma.fpkm.gz',
				datatype: 'FPKM',

				// for boxplots & circles, and the standalone expression track
				itemcolor: 'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit: 5000000,

				// yu's data & method for ase/outlier
				ase: {
					qvalue: 0.05,
					meandelta_monoallelic: 0.3,
					asemarkernumber_biallelic: 0,
					color_noinfo: '#858585',
					color_notsure: '#A8E0B5',
					color_biallelic: '#40859C',
					color_monoallelic: '#d95f02'
				},
				outlier: {
					pvalue: 0.05,
					color: '#FF8875'
				}
			}
		}
	}
}
