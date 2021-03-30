const samplenamekey = 'sample_name'

module.exports = {
	genome: 'hg19',
	isMds: true,
	about: [
		{ k: 'Cohort', v: 'ALL cellline' },
		{ k: 'CNV', v: 'Somatic copy number changes' },
		{ k: 'LOH', v: 'Somatic copy-neutral LOH' },
		{ k: 'Fusion', v: 'Tumor RNA-seq fusion' },
		{ k: 'SNV/indel', v: 'Somatic mutations of tumor, and germline pathogenic mutations' },
		{ k: 'RNA splice junction', v: 'Tumor RNA splice junctions' }
	],
	sampleAssayTrack: {
		file: 'genomePaint_demo/tracktable/__table'
	},

	/*
	cohort and sample annotation
	*/
	cohort: {
		files: [{ file: 'genomePaint_demo/sampletable/sample.table' }],
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
				},
				sample_type: {
					label: 'Sample type',
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
					wgs: { name: 'WGS', label: 'Whole-genome sequencing' },
					wes: { name: 'WES', label: 'Whole-exome sequencing' }
				},
				hidden: 1,
				filter: 1
			}
		}
	},

	locusAttribute: {
		attributes: {
			COSMIC: {
				label: 'COSMIC',
				appendto_link: 'https://cancer.sanger.ac.uk/cosmic/mutation/overview?id='
			}
		}
	},

	queries: {
		svcnv: {
			name: 'Demo mutation',
			istrack: true,
			type: 'mdssvcnv',
			file: 'genomePaint_demo/demo.svcnv.gz',

			// cnv
			valueCutoff: 0.2,
			bplengthUpperLimit: 2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff: 0.1,
			lohLengthUpperLimit: 2000000,

			groupsamplebyattr: {
				attrlst: [
					{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
					{ k: 'Fusion', label: 'Subtype', full: 'Fusion' }
				],
				attrnamespacer: ', '
			},
			expressionrank_querykey: 'genefpkm',
			vcf_querykey: 'snvindel',
			multihidelabel_vcf: true,
			multihidelabel_fusion: false,
			multihidelabel_sv: true
		},

		snvindel: {
			hideforthemoment: 1,
			name: 'Demo SNV/indel',
			istrack: true,
			type: 'mdsvcf',
			viewrangeupperlimit: 2000000,
			tracks: [
				{
					file: 'genomePaint_demo/demo.vcf.gz',
					type: 'vcf'
				}
			]
		},

		genefpkm: {
			hideforthemoment: 1,
			name: 'ALL cellline RNA-seq gene FPKM',
			isgenenumeric: true,
			file: 'genomePaint_demo/demo.fpkm.gz',
			datatype: 'FPKM',

			// for boxplots & circles, and the standalone expression track
			itemcolor: 'green',

			// for boxplots & circles, and the standalone expression track
			itemcolor: 'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit: 5000000,

			/*
			one boxplot for each sample group
			the grouping method must be same as svcnv
			*/
			boxplotbysamplegroup: {
				attributes: [
					{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
					{ k: 'Fusion', label: 'Subtype', full: 'Fusion' }
				]
			}
		}
	}
}
