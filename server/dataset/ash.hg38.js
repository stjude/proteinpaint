module.exports = {
	isMds3: true,
	genome: 'hg38',

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	/*
	termdb: {
		// for each term from an input list, get total sizes for each category
		// used for sunburst and summary
		termid2totalsize2: {
			gdcapi: termTotalSizeGdcapi
		},

		dictionary: {
			// runs termdb.gdc.js to init gdc dictionary
			// create standard helpers at ds.cohort.termdb.q{}
			gdcapi: true
		},

		// pending
		allowCaseDetails: {
			sample_id_key: 'case_uuid',
			terms: ['case.diagnoses']
		}
	},
	*/

	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		//////////////////////////////
		// termidlst and sunburst_ids are sent to client as default lists for different purposes
		// subject to user-customization there, and sent back via request arg for computing
		// not to be used on server-side!

		// list of term ids as sample details
		//termidlst: []

		// small list of terms for sunburst rings
		//sunburst_ids: []

		// quick fix: flag to indicate availability of these fields, so as to create new columns in sample table
		sampleHasSsmReadDepth: true, // corresponds to .ssm_read_depth{} of a sample
		sampleHasSsmTotalNormal: true, // corresponds to .totalNormal:int of a sample

		// either of sample_id_key or sample_id_getter will be required for making url link for a sample
		//sample_id_key: 'case_id',

		//url: {}
	},

	queries: {
		snvindel: {
			forTrack: true,
			byrange: {
				vcffile: 'files/hg38/ash/panall.hg38.vcf.gz'
			}
		},
		svfusion: {
			byrange: {
				file: 'files/hg38/ash/panall.svfusion.hg38.gz'
			}
		},
		/*
		cnvpileup:{},
		geneexpression: {
		},
		*/
	}
}
