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

module.exports = {
	genome: 'hg19',
	isMds: true,

	sampleAssayTrack: {
		file: 'files/hg19/propel/tracktable/__table'
	},

	singlesamplemutationjson: {
		file: 'files/hg19/propel/mutationpersample/table'
	},

	/*
	cohort and sample annotation
	*/
	cohort: {
		files: [
			{ file: 'files/hg19/propel/sampletable/propel.samples' }
		],
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
		/*
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
			}
		},
		*/

	},

	mutationAttribute: {
		attributes: {
			dna_assay: {
				label: 'DNA assay',
				values: {
					cgi: { name: 'CGI', label: 'Complete Genomics whole-genome sequencing' },
					wgs: { name: 'WGS', label: 'Whole-genome sequencing' },
					wes: { name: 'WES', label: 'Whole-exome sequencing' },
					snp6: { name: 'SNP6', label: 'SNP Array 6.0' },
					cc: { name: 'CapVal', label: 'Capture validation' }
				},
				filter: 1
			},
			rna_assay: {
				label: 'RNA assay',
				values: {
					total: { name: 'Total RNA' },
					polya: { name: 'Poly(A)-selected' }
				},
				hidden: 1,
				filter: 1
			},
			project: {
				label: 'Project',
				values: {
					pantarget: { name: 'Pan-TARGET', label: 'Pan-cancer analysis of the NCI TARGET dataset' },
					pcgp: { name: 'PCGP', label: 'Pediatric Cancer Genome Project' },
					scmc: { name: 'SCMC', label: "Shanghai Children's Medical Center pediatric ALL project" },
					pedccl: { name: 'PedCCL', label: 'Pediatric Cancer Cell Lines' }
				},
				filter: 1
			},
			vorigin: {
				label: 'Variant origin',
				values: {
					somatic: { name: 'Somatic' },
					germline: { name: 'Germline' }
				},
				filter: 1
			},
			pmid: {
				label: 'PubMed',
				appendto_link: 'https://pubmed.ncbi.nlm.nih.gov/'
			}
		}
	},

	queries: {
		svcnv: {
			name: 'PROPEL tumor mutation',
			istrack: true,
			type: 'mdssvcnv',
			file: 'files/hg19/propel/propel.svcnv.gz',

			/*
			this is to hide loh events which overlap with cnv events
			this is due to the fact that many such cnv-overlapping events existing in this pediatric dataset
			and jinghui wants them to be hidden
			so only to show copy-neutral loh

			TODO enable as client-side option
			*/
			hideLOHwithCNVoverlap: true,

			// cnv
			valueCutoff: 0.2,
			bplengthUpperLimit: 2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff: 0.1,
			lohLengthUpperLimit: 2000000,
			/*
			groupsamplebyattr: {
				attrlst: [
					{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full' },
					{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' }
				],
				sortgroupby: {
					key: 'diagnosis_group_short',
					order: ['ST', 'BT', 'HM']
				},
				attrnamespacer: ', '
			},
			*/
			vcf_querykey: 'snvindel',

			multihidelabel_vcf: false,
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
			name: 'PROPEL tumor SNV/indel',
			istrack: true,
			type: 'mdsvcf',
			viewrangeupperlimit: 2000000,
			tracks: [
				{
					file: 'files/hg19/propel/propel.vcf.gz',
					type: 'vcf'
				}
			],
			singlesamples: {
				tablefile: 'files/hg19/propel/split.vcf/table'
			}
		}
		/*	
		genefpkm: {
			hideforthemoment: 1,
			name: 'Pediatric tumor RNA-seq gene FPKM',
			isgenenumeric: true,
			file: 'hg19/Pediatric/pediatric.fpkm.hg19.gz',
			datatype: 'FPKM',

			// for boxplots & circles, and the standalone expression track
			itemcolor: 'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit: 5000000,

			boxplotbysamplegroup: {
				attributes: [
					{ k: 'diagnosis_group_short', label: 'Group', full: 'diagnosis_group_full' },
					{ k: 'diagnosis_short', label: 'Cancer', full: 'diagnosis_full' }
				]
			},

			// yu's data & method for ase/outlier
			ase: {
				qvalue: 0.05,
				meandelta_monoallelic: 0.3,
				asemarkernumber_biallelic: 0,
				//meandelta_biallelic:0.1,  no longer used
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
		*/
	}
}
