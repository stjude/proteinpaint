module.exports = function(common) {
	const samplenamekey = 'sample_name'
	return {
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'hg38/sjlife/assaytracks/wgs.bw'
		},

		cohort: {
			files: [{ file: 'hg38/sjlife/sampletable/samples.table' }],
			samplenamekey: samplenamekey,
			tohash: (item, ds) => {
				const n = item[samplenamekey]
				if (ds.cohort.annotation[n]) {
					for (const k in item) {
						ds.cohort.annotation[n][k] = item[k]
					}
				} else {
					ds.cohort.annotation[n] = item
				}
			},
			sampleAttribute: {
				attributes: {
					diaggrp: {
						label: 'Diagnosis group',
						filter: 1
					},
					diag: {
						label: 'Diagnosis'
					},
					gender: {
						label: 'Gender',
						filter: 1
					},
					race: {
						label: 'Race',
						filter: 1
					},
					ethnic: {
						label: 'Ethnithity',
						filter: 1
					},
					Age_dx: {
						label: 'Age at diagnosis'
					}
				}
			}
		},

		/*
		locusAttribute:{ // FIXME
			attributes:{
				CLNSIG:{
					label:'Clinical significance',
					filter:1,
					values:{
					}
				}
			}
		},

		alleleAttribute:{
			attributes:{
				ExAC_AF:{
					label:'ExAC',
					isnumeric:1,
					filter:1,
					cutoffvalue:0.01,
					keeplowerthan:true
				},
				AF:{
					label:'AF',
					isnumeric:1,
					filter:1,
					cutoffvalue:0.01,
					keeplowerthan:true
				},
				CADD_phred:{
					label:'CADD_phred',
					filter:1,
					isnumeric:1,
					cutoffvalue:10,
				}
			}
		},
		*/

		mutationAttribute: {
			attributes: {
				discordantreads: {
					label: 'Discordant read pairs'
				}
			}
		},

		queries: {
			svcnv: {
				name: 'SJLIFE germline mutation',

				//showfullmode:true,

				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'hg38/sjlife/cnv.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				groupsamplebyattr: {
					attrlst: [{ k: 'diaggrp', label: 'Diagnosis group' }],
					sortgroupby: {
						key: 'diaggrp',
						order: [
							'Acute lymphoblastic leukemia',
							'Acute myeloid leukemia',
							'Other leukemia',
							'Central Nervous System (CNS)',
							'Carcinoma',
							'Chronic myeloid leukemia',
							'Colon carcinoma',
							'Ewing sarcoma family of tumors',
							'Germ cell tumor',
							'Histiocytosis',
							'Hodgkin lymphoma',
							'Liver malignancies',
							'Melanoma',
							'Nasopharyngeal carcinoma',
							'Neuroblastoma',
							'Non-Hodgkin lymphoma',
							'Non-malignancy',
							'Osteosarcoma',
							'Other malignancy',
							'Retinoblastoma',
							'Rhabdomyosarcoma',
							'Soft tissue sarcoma',
							'Wilms tumor'
						]
					},
					attrnamespacer: ', '
				},

				//vcf_querykey:'snvindel',

				multihidelabel_vcf: false,
				multihidelabel_sv: true,

				no_loh: true
			}

			/*
			snvindel:{
				name:'ALS germline SNV/indel',
				istrack:true,
				type:common.tkt.mdsvcf,
				viewrangeupperlimit:2000000,
				tracks:[
					{
						file:'hg38/als/mds/vcf/ALS329.vep.ann.hg38_multianno.clinvar.ExAC.NFE.vcf.gz',
						type:'vcf',
						samplenameconvert: str=>{
							return str.split('-')[0]
						}
					},
				]
			},
			*/
		}
	}
}
