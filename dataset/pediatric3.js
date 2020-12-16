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
		genome: 'hg38',
		isMds: true,
		about: [{ k: 'Copy number variantion', v: 'Somatic CNV from 571 tumor samples were derived from ... ...' }],
		dbFile: 'anno/db/pediatric.hg19.db',

		cohort: {
			files: [
				// possible to have file-specific logic
				{ file: 'anno/db/pediatric.samples' }
			],
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
			hierarchies: {
				lst: [
					{
						name: 'Cancer',
						levels: cohorthierarchy
					}
				]
			}

			/*
			attributes.lst[] are not released to client
			used in mdsjunction & mdscnv

			attributes:{
				lst:[
					{key:'diagnosis_group_short',label:'Cancer group',
						values:{
							BT:{label:"Brain Tumor"},
							HM:{label:"Hematopoietic Malignancies"},
							ST:{label:"Solid Tumor"},
						}
					},
					// cut -f6,7 ~/data/tp/anno/db/pediatric.samples|sort -u|awk '{FS="\t";printf("{%s:{label:\"%s\"}},\n"),$1,$2}'
					{key:'diagnosis_short',label:'Cancer type',
						values:{
							ACT:{label:"Adrenocortical Carcinoma"},
							AML:{label:"Acute Myeloid Leukemia"},
							BALL:{label:"B-cell Acute Lymphoblastic Leukemia"},
							CPC:{label:"Choroid Plexus Carcinoma"},
							EPD:{label:"Ependymoma"},
							EWS:{label:"Ewing's sarcoma"},
							HGG:{label:"High Grade Glioma"},
							LGG:{label:"Low Grade Glioma"},
							MB:{label:"Medulloblastoma"},
							MEL:{label:"Melanoma"},
							MLL:{label:"Mixed Lineage Leukemia"},
							NBL:{label:"Neuroblastoma"},
							OS:{label:"Osteosarcoma"},
							RB:{label:"Retinoblastoma"},
							RHB:{label:"Rhabdosarcoma"},
							TALL:{label:"T-cell Acute Lymphoblastic Leukemia"},
							WLM:{label:"Wilms' tumor"},
						}
					},
				],
				defaulthidden:{diagnosis_short:{BALL:1}}
			}
			*/
		},

		queries: {
			somaticcnv: {
				name: 'PCGP somatic CNV',
				istrack: true,
				type: common.tkt.mdscnv,
				file: 'hg38/PCGP/cnv/cnv.gz',
				valueLabel: 'log2(ratio)',
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000
			}
		}
	}
}
