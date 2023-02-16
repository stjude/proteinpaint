module.exports = {
	isMds3: true,
	genome: 'hg38',

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	cohort: {
		// expose matrix for testing. should be okay to merge to master as for now the ash dataset is not exposed from mass ui
		allowedChartTypes: ['summary', 'matrix'],

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
		sunburst_twLst: [{ id: 'Lineage', q: {} }, { id: 'Primary_subtype', q: {} }]
	},

	queries: {
		// temporary fix for genomeBrowser app to show gene model
		defaultBlock2GeneMode: true,

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
