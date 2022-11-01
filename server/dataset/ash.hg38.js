module.exports = {
	isMds3: true,
	genome: 'hg38',

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	cohort: {
		// expose matrix for testing. should be okay to merge to master as for now the ash dataset is not exposed from mass ui
		allowedChartTypes: ['barchart', 'matrix'],

		db: { file: 'files/hg38/ash/db' },
		termdb: {
			termid2totalsize2: {}
		}
	},

	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		// list of term ids as sample details
		twLst: [
			{ id: 'Lineage', q: {} },
			{ id: 'Primary_subtype', q: {} },
			{ id: 'Secondary_subtype', q: {} },
			{ id: 'Sex', q: {} },
			{ id: 'Age', q: {} },
			{ id: 'race', q: {} }
		],

		// small list of terms for sunburst rings
		sunburst_ids: [{ id: 'Lineage', q: {} }, { id: 'Primary_subtype', q: {} }],

		// quick fix: flag to indicate availability of these fields, so as to create new columns in sample table
		sampleHasSsmReadDepth: true, // corresponds to .ssm_read_depth{} of a sample
		sampleHasSsmTotalNormal: true // corresponds to .totalNormal:int of a sample

		// either of sample_id_key or sample_id_getter will be required for making url link for a sample
		//sample_id_key: 'case_id',

		//url: {}
	},

	queries: {
		snvindel: {
			forTrack: true,
			byrange: {
				bcffile: 'files/hg38/ash/panall.hg38.bcf.gz'
			}
		},
		svfusion: {
			byrange: {
				file: 'files/hg38/ash/panall.svfusion.hg38.gz'
			}
		}
		/*
		cnvpileup:{},
		geneexpression: {
		},
		*/
	}
}
