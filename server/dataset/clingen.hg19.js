module.exports = {
	isMds3: true,
	genome: 'hg19',

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	cohort: {
		// expose matrix for testing. should be okay to merge to master as for now the ash dataset is not exposed from mass ui
		allowedChartTypes: ['summary', 'matrix'],

		db: { file: 'hg19/clingen/db' },
		termdb: {
			termid2totalsize2: {}
		}
	},
	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		// list of term ids as sample details
		twLst: [
			{ id: 'Lineage', q: {} }
			//{ id: 'Primary_subtype', q: {} },
			//{ id: 'Secondary_subtype', q: {} },
			//{ id: 'Sex', q: {} },
			//{ id: 'Age', q: {} },
			//{ id: 'race', q: {} }
		],

		// small list of terms for sunburst rings
		sunburst_twLst: [{ id: 'Lineage', q: {} }],

		// quick fix: flag to indicate availability of these fields, so as to create new columns in sample table
		sampleHasSsmReadDepth: true, // corresponds to .ssm_read_depth{} of a sample
		sampleHasSsmTotalNormal: true // corresponds to .totalNormal:int of a sample
	},

	queries: {
		// temporary fix for genomeBrowser app to show gene model
		defaultBlock2GeneMode: true,

		snvindel: {
			forTrack: true,
			byrange: {
				bcffile: 'hg19/clingen/clinGen.hg19.bcf.gz'
			},
			skewerRim: {
				type: 'format',
				formatKey: 'vorigin',
				rim1value: 'germline',
				noRimName: 'somatic'
			}
		},
		svfusion: {
			byrange: {
				file: 'hg19/clingen/clinGen.svfusion.hg19.gz'
			}
		}
		/*
		cnvpileup:{},
		geneexpression: {
		},
		*/
	}
}
