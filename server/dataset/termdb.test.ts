import { Mds3 } from '../shared/types'
import * as serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import * as path from 'path'
import { existsSync, unlinkSync, symlinkSync, access, constants } from 'fs'

/*
the "test mule" for the type of termdb dataset using server-side sqlite3 db
follows the mds3 specification
and is used to power many integration tests

to enable this dataset on your pp instance, have this entry in hg38-test datasets array of your "serverconfig.json":

 { "name": "TermdbTest", "jsfile": "./dataset/termdb.test.js" }

files are hosted at specified locations under tp/
upon loading this script, directories under tp/ are auto-created if missing
data files already committed in the repo are copied over to tp/ locations for the dataset to work

reason:
- db file is anonymized and unindentifiable
- allow continuous integration test
- ensure TermdbTest/db to be fully static and recoverable, to ensure tests work as expected

*/

copyDataFilesFromRepo2Tp()

export default <Mds3>{
	isMds3: true,
	cohort: {
		db: {
			file: 'files/hg38/TermdbTest/db'
		},
		allowedChartTypes: [
			'summary',
			'survival',
			'matrix',
			'sampleScatter',
			'cuminc',
			'dataDownload',
			'sampleView',
			'regression'
		],
		termdb: {
			displaySampleIds: true, // allow to display sample-level data

			timeUnit: 'years',

			minTimeSinceDx: 5, // enrollment in sjlife requires 5 years since cancer diagnosis

			ageEndOffset: 0.00274, // number of years to offset ending age of patients
			// for cox outcome with timeScale='age'
			// 1 day (i.e. 1/365 or 0.00274) needs to be added
			// to age_end to prevent age_end = age_start (which
			// would cause regression analysis to fail in R)

			cohortStartTimeMsg: '5 years post cancer diagnosis',

			selectCohort: {
				// wrap term.id into a term json object so as to use it in tvs;
				// the term is not required to exist in termdb
				// term.id is specific to this dataset, should not use literally in client/server code but always through a variable
				term: {
					id: 'subcohort',
					type: 'categorical'
				},
				prompt: 'Select a cohort and test the plots.',
				values: [
					// <ul><li> for items, with a radio button for each.
					{
						keys: ['ABC'],
						label: 'ABC Cohort (ABC)',
						shortLabel: 'ABC',
						isdefault: true
					},
					{
						keys: ['XYZ'],
						label: 'XYZ cohort (XYZ)',
						shortLabel: 'XYZ'
					},
					{
						keys: ['ABC', 'XYZ'],
						label: 'Combined ABC+XYZ*',
						shortLabel: 'ABC+XYZ'
						// show note under label in smaller text size
					}
				],
				asterisk: '*fineprint on an item'
			},

			dataDownloadCatch: {
				helpLink: 'https://university.stjude.cloud/docs/visualization-community/data-download/',
				missingAccess: {
					message:
						"You are missing approval to one or more of the required datasets. Please go to <a target=_blank href='MISSING-ACCESS-LINK'>Genomics Platform Data Browser</a> to request access. For more information, please see this <a target=_blank href='https://university.stjude.cloud/docs/visualization-community/data-download/'>tutorial.</a>",
					links: {
						sjlife: 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1002',
						ccss: 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1005',
						'sjlife,ccss': 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1002,SJC-DS-1005',
						fake: 'https://platform.stjude.cloud/data/cohorts?selected_tags=SJC-DS-1002'
					}
				},
				jwt: {
					'Invalid token': 'https://university.stjude.cloud/docs/visualization-community/data-download/'
				}
			},
			matrix: {
				settings: {
					ignoreCnvValues: true
				}
			}
		},
		scatterplots: {
			plots: [
				{
					name: 'TermdbTest TSNE',
					dimension: 2,
					file: 'files/hg38/TermdbTest/tnse.txt',
					colorTW: { id: 'diaggrp' }
				}
			]
		},
		matrixplots: {
			plots: [
				{
					name: 'Matrix plot',
					file: 'files/hg38/TermdbTest/TermdbTest_matrix.json'
				}
			]
		}
	},
	customTwQByType: {
		// dataset-specific termsetting configs on certain term types
		geneVariant: {
			default: { cnvGainCutoff: 0.1, cnvLossCutoff: -0.1, cnvMaxLength: 0 },
			byGene: {
				// key is term.name, thus possible to use non-gene names e.g. C19MC
				MYCN: { cnvGainCutoff: 0.5, cnvLossCutoff: -0.1, cnvMaxLength: 0 }
			}
		}
	},
	variant2samples: {
		variantkey: 'ssm_id', // required, tells client to return ssm_id for identifying variants

		// list of term ids as sample details
		twLst: [
			{ id: 'sex', q: {} },
			{ id: 'diaggrp', q: {} },
			{ id: 'agedx', q: {} }
		],

		// small list of terms for sunburst rings
		sunburst_twLst: [{ id: 'sex', q: {} }]
	},
	queries: {
		// temporary fix for genomeBrowser app to show gene model
		defaultBlock2GeneMode: true,

		snvindel: {
			forTrack: true,
			byrange: {
				bcffile: 'files/hg38/TermdbTest/TermdbTest.bcf.gz'
			},
			skewerRim: {
				type: 'format',
				formatKey: 'origin',
				rim1value: 'germline',
				noRimValue: 'somatic'
			}
		},
		svfusion: {
			byrange: {
				file: 'files/hg38/TermdbTest/TermdbTest_Fusion.gz'
			}
		},
		cnv: {
			byrange: {
				src: 'native',
				file: 'files/hg38/TermdbTest/TermdbTest_CNV_gene.gz'
			}
		},
		/*
		on the fly cnv calls from gene body probe signals are no longer used
		probe2cnv:{
			file: 'files/hg19/pnet/PNET.probesignals.gz'
		}
		*/
		singleSampleMutation: {
			src: 'native',
			sample_id_key: 'sample_id',
			folder: 'files/hg38/TermdbTest/mutationpersample/'
		},
		singleSampleGenomeQuantification: {
			// to show genome-wide quantification plot for a sample
			MethylationArray: {
				description:
					'Genome-wide copy number variation based on tumor/normal methylation array, averaged at genomic bins.',
				min: -1.2,
				max: 1.2,
				sample_id_key: 'sample_id',
				folder: 'files/hg38/TermdbTest/methylationArrayNormalSubtracted_bins/', // binned data, not probe-level
				positiveColor: '#a35069',
				negativeColor: '#5051a3',
				singleSampleGbtk: 'methylationProbeSignal'
			}
		},
		singleSampleGbtk: {
			methylationProbeSignal: {
				description: 'Probe signals from methylation array.',
				min: -1.2,
				max: 1.2,
				sample_id_key: 'sample_id',
				folder: 'files/hg38/TermdbTest/methylationArrayNormalSubtracted/' // probe-level data, only for locus view as genome browser track
				// each file is 1.gz and 1.gz.tbi, bedgraph format
			}
		}
	},
	assayAvailability: {
		// use "genetic_race" as fake sources of assay availability
		byDt: {
			// snvindel, differentiating sample origin
			1: {
				byOrigin: {
					germline: {
						term_id: 'genetic_race',
						label: 'Germline', // human readable label of this origin
						yes: { value: ['European Ancestry', 'Asian Ancestry'] },
						no: { value: ['Multi-Ancestry-Admixed', 'African Ancestry'] }
					},
					somatic: {
						term_id: 'genetic_race',
						label: 'Somatic',
						yes: { value: ['European Ancestry', 'African Ancestry'] },
						no: { value: ['Multi-Ancestry-Admixed', 'Asian Ancestry'] }
					}
				}
			},

			// fusion
			2: {
				//mutations are detected from RNAseq
				term_id: 'genetic_race',
				yes: { value: ['European Ancestry', 'African Ancestry'] },
				no: { value: ['Asian Ancestry', 'Multi-Ancestry-Admixed'] }
			},
			// cnv
			4: {
				// mutations are detected from Methylation
				term_id: 'genetic_race',
				yes: { value: ['European Ancestry', 'African Ancestry'] },
				no: { value: ['Asian Ancestry', 'Multi-Ancestry-Admixed'] }
			}
		}
	}
}

function copyDataFilesFromRepo2Tp() {
	// when running tests in a CI environment, the workflow script should copy
	// the server/test/tp dir as serverconfig.tpmasterdir, and do not trigger
	// the symlinks below
	if (existsSync('/home/root/pp')) return

	const targetDir = path.join(serverconfig.binpath, 'test/tp/files/hg38/TermdbTest')
	const datadir = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest')

	// no need to set the symlink when the target TermdbTest dir
	// already equals the datadir under serverconfig.tpmasterdir
	if (datadir == `${serverconfig.binpath}/test/tp`) {
		access(datadir, constants.R_OK | constants.W_OK, err => {
			if (!err) {
				try {
					if (!existsSync(datadir)) unlinkSync(datadir)
					symlinkSync(targetDir, datadir)
				} catch (error) {
					console.warn('Error while coping data files from Repo to Tp: ' + error)
				}
			} else {
				console.warn(`user doesn't have sufficient permissions for `)
			}
		})
	}
}
