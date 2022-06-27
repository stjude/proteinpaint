const terms = [
	{ id: 'Lineage', type: 'categorical' },
	{ id: 'Primary_subtype', name: 'Primary subtype', type: 'categorical' },
	{ id: 'Secondary_subtype', name: 'Secondary subtype', type: 'categorical' },
	{ id: 'Sex', type: 'categorical' },
	{ id: 'Age', name: 'Age of diagnosis', type: 'float' }
]

module.exports = {
	isMds3: true,
	genome: 'hg38',

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	termdb: {
		terms,
		annotationFile: 'files/hg38/ash/panall.sample'
	},

	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		//////////////////////////////
		// termidlst and sunburst_ids are sent to client as default lists for different purposes
		// subject to user-customization there, and sent back via request arg for computing
		// not to be used on server-side!

		// list of term ids as sample details
		termidlst: terms.map(i => i.id),

		// small list of terms for sunburst rings
		sunburst_ids: ['Lineage', 'Primary_subtype'],

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
