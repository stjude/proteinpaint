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

	/* hope this can be applied to all types of variants
	but if it can only be applied to ssm, then it may be moved to queries.snvindel{}
	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		//////////////////////////////
		// termidlst and sunburst_ids are sent to client as default lists for different purposes
		// subject to user-customization there, and sent back via request arg for computing
		// not to be used on server-side!

		// list of term ids as sample details
		termidlst: [
			'case.disease_type',
			'case.primary_site',
			'case.project.project_id',
			'case.demographic.gender',
			//'case.diagnoses.age_at_diagnosis',
			//'case.diagnoses.treatments.therapeutic_agents',
			'case.demographic.race',
			'case.demographic.ethnicity'
		],

		// small list of terms for sunburst rings
		sunburst_ids: ['case.disease_type', 'case.primary_site'],

		//////////////////////////////
		// optional extra terms to append to client-provided term ids when get='samples'
		// not to send to client but secretly used in backend computing
		extra_termids_samples: [
			'ssm.ssm_id',
			'case.case_id',
			'case.observation.read_depth.t_alt_count',
			'case.observation.read_depth.t_depth',
			'case.observation.read_depth.n_depth',
			'case.observation.sample.tumor_sample_barcode'
		],

		// quick fix: flag to indicate availability of these fields, so as to create new columns in sample table
		sampleHasSsmReadDepth: true, // corresponds to .ssm_read_depth{} of a sample
		sampleHasSsmTotalNormal: true, // corresponds to .totalNormal:int of a sample

		// either of sample_id_key or sample_id_getter will be required for making url link for a sample
		//sample_id_key: 'case_id',
		sample_id_getter,

		url: {
			base: 'https://portal.gdc.cancer.gov/cases/',
			// if "namekey" is provided, use the given key to obtain sample name to append to url
			// if missing, will require sample_id_key
			namekey: 'case_uuid'
		},
		gdcapi: variant2samplesGdcapi
	},
	*/

	queries: {
		snvindel: {
			forTrack: true,
			/*
			url: {
				// for adding url link in variant panel
				base: 'https://portal.gdc.cancer.gov/ssms/',
				key: 'ssm_id'
			},
			*/
			byrange: {
				vcffile: 'files/hg38/ash/panall.hg38.vcf.gz'
			}
		}

		/*
		svfusion: {
		},
		cnvpileup:{},
		geneexpression: {
		},
		*/
	}
}
