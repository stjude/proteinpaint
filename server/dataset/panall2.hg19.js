const samplenamekey = 'sample_name'

module.exports = {
	genome: 'hg19',
	isMds: true,
	about: [
		{ k: 'Cohort', v: 'ALL cellline' },
		{ k: 'CNV', v: 'Somatic copy number changes' },
		{ k: 'Fusion', v: 'Tumor RNA-seq fusion' }
	],
	/*
	sampleAssayTrack:{
		file:'genomePaint_demo/tracktable/__table'
	},
	*/

	/*
	cohort and sample annotation
	*/
	cohort: {
		files: [{ file: 'hg19/panall2/sampletable/PanALL_SampleTable_GenomePaint_2020-5-13.txt' }],
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
				diagnosis_short: {
					label: 'Cancer',
					filter: 1
				},
				Subtype: {
					label: 'Subtype',
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
					wes: { name: 'WES', label: 'Whole-exome sequencing' },
					snp: { name: 'SNP', label: 'SNP6 array' }
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
			name: 'ALL mutation',
			istrack: true,
			type: 'mdssvcnv',
			isfull: true,
			file: 'hg19/panall2/PanALL_CnvSvTable_GenomePaint_2020-5-13.svcnv.gz',

			// cnv
			valueCutoff: 0.15, // 0.2 originally
			bplengthUpperLimit: 5000000, // DON'T limit cnv length to focal events

			// loh
			segmeanValueCutoff: 0.1,
			lohLengthUpperLimit: 2000000,

			groupsamplebyattr: {
				attrlst: [
					{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
					{ k: 'Subtype', label: 'Subtype', full: 'Subtype' }
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
			name: 'ALL SNVindels',
			istrack: true,
			type: 'mdsvcf',
			viewrangeupperlimit: 2000000,
			tracks: [
				{
					file: 'hg19/panall2/PanAll.hg19.vcf.gz',
					type: 'vcf'
				}
			],
			singlesamples: {
				tablefile: 'hg19/panall2/split.vcf/table'
			}
		},
		genefpkm: {
			name: 'ALL RNA-seq gene log2(FPKM) values',
			isgenenumeric: true,
			file: 'hg19/pan-all/rlog.ball/rlog.gz',
			datatype: 'log2(FPKM)',
			no_ase: true,

			// for boxplots & circles, and the standalone expression track
			itemcolor: 'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit: 5000000,

			boxplotbysamplegroup: {
				attributes: [
					{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' },
					{ k: 'Fusion', label: 'Subtype', full: 'Fusion' }
				]
			}
		}
	}
}
