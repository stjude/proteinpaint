import type { Mds3 } from '#types'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import * as path from 'path'
import { existsSync, unlinkSync, symlinkSync, access, constants } from 'fs'

// import { WSISample } from '@sjcrh/proteinpaint-types/routes/wsisamples.js'

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

// export a function to allow reuse of this dataset without causing conflicts
// for the different use cases in runtime/tests
export default function (): Mds3 {
	return {
		isMds3: true,
		isSupportedChartOverride: {
			runChart: () => true,
			frequencyChart: () => true,
			report: () => true
		},
		cohort: {
			massNav: {
				tabs: {
					about: {
						dataRelease: {
							version: '?',
							link: 'testLink'
						},
						additionalInfo: '<a href=testLink>Tutorial</a> <a href=testLink>Get help</a>',
						activeItems: {
							items: [
								{
									title: 'Demo Active Item Plot Button',
									plot: {
										chartType: 'summary',
										term: { id: 'agedx' },
										term2: { id: 'sex' }
									}
								}
							]
						}
					}
				}
			},
			db: {
				file: 'files/hg38/TermdbTest/db'
			},

			termdb: {
				allowedTermTypes: ['geneVariant'],
				displaySampleIds: () => true, // allow to display sample-level data

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
						type: 'multivalue'
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
				},
				termid2totalsize2: {},
				regression: {
					settings: {
						coxDisclaimer: 'This is a test disclaimer for the cox regression analysis.'
					}
				},
				plotConfigByCohort: {
					default: {
						report: {
							filterTWs: [{ id: 'diaggrp' }],

							sections: [
								{
									name: 'Demographics',
									plots: [
										{
											chartType: 'barchart',
											settings: { barchart: { colorBars: true, showPercent: true } },

											term: {
												id: 'agedx'
											}
										},
										{
											chartType: 'barchart',
											term: { id: 'sex' },
											settings: { barchart: { colorBars: true, showPercent: true } }
										},
										{
											chartType: 'barchart',
											term: { id: 'genetic_race' },
											settings: { barchart: { colorBars: true, showPercent: true } }
										}
									]
								},
								{
									name: 'Diagnosis',
									plots: [
										{
											chartType: 'barchart',
											term: { id: 'diaggrp' },
											settings: { barchart: { colorBars: true, showPercent: true } }
										}
									]
								},
								{
									name: 'Treatment',
									plots: [
										{
											chartType: 'barchart',
											term: { id: 'hrtavg' },
											settings: { barchart: { colorBars: true, showPercent: true } }
										},
										{
											chartType: 'barchart',
											term: { id: 'aaclassic_5' },
											settings: { barchart: { colorBars: true, showPercent: true } }
										}
									]
								},
								{
									name: 'Survival',
									plots: [
										{
											chartType: 'survival',
											term: { id: 'efs' },
											term2: { id: 'diaggrp' }
										},
										{
											chartType: 'survival',
											term: { id: 'os' },
											term2: { id: 'diaggrp' }
										}
									]
								}
							]
						}
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
				file: 'files/hg38/TermdbTest/TermdbTest_CNV_gene.gz'
			},
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
			},
			geneExpression: {
				src: 'native',
				file: 'files/hg38/TermdbTest/TermdbTest.fpkm.matrix.h5'
			},
			topVariablyExpressedGenes: {
				src: 'native'
			},
			rnaseqGeneCount: {
				storage_type: 'HDF5',
				file: 'files/hg38/TermdbTest/TermdbTest.geneCounts.h5'
			},
			singleCell: {
				samples: {
					sampleColumns: [{ termid: 'sex' }],
					extraSampleTabLabel: 'sex'
				},
				data: {
					sameLegend: true,
					src: 'native',
					plots: [
						{
							name: 'scRNA',
							folder: 'files/hg38/TermdbTest/scrna/umap',
							fileSuffix: '_umap.txt',
							colorColumns: [
								{
									index: 3,
									name: 'CellType'
								}
							],
							coordsColumns: { x: 1, y: 2 },
							selected: true
						}
					]
				},
				geneExpression: {
					src: 'native',
					folder: 'files/hg38/TermdbTest/scrna/geneExpHdf5'
				}
			},
			WSImages: {
				type: 'H&E',
				imageBySampleFolder: 'files/hg38/TermdbTest/wsimages'
			}
		},
		assayAvailability: {
			// term used below must be annotated on samples rather than patients(root). otherwise matrix will pull wrong samples for geneVariant term
			byDt: {
				// snvindel, differentiating sample origin
				1: {
					byOrigin: {
						germline: {
							term_id: 'assayavailability_germline',
							label: 'Germline', // human readable label of this origin
							yes: { value: ['1'] },
							no: { value: ['2'] }
						},
						somatic: {
							term_id: 'wgs_curated',
							label: 'Somatic',
							yes: { value: ['1'] },
							no: { value: ['0'] } // the category doesn't exist in termdb but is still supplied since somatic.no{} is required
						}
					}
				},

				// fusion
				2: {
					term_id: 'assayavailability_fusion',
					yes: { value: ['1'] },
					no: { value: ['2'] }
				},
				// cnv
				4: {
					term_id: 'assayavailability_cnv',
					yes: { value: ['1'] },
					no: { value: ['2'] }
				}
			}
		}
	} satisfies Mds3
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
