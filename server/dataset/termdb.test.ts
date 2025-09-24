import type { Mds3 } from '#types'

/*
the "test mule" for the type of termdb dataset using server-side sqlite3 db
follows the mds3 specification and is used to power many integration tests

Design rationale:
- db file is anonymized and unindentifiable
- allow continuous integration test
- ensure TermdbTest/db to be fully static and recoverable, to ensure tests work as expected

To enable this dataset on your pp instance, have this entry in hg38-test datasets array of your "serverconfig.json":

 { "name": "TermdbTest", "jsfile": "./dataset/termdb.test.js" }

Files are hosted at the specified locations under tp/

NOTE: genome/hg38.test.js 
	- uses copyDataFilesFromRepo2Tp() to create <tp>/files/hg38/TermdbTest
	  dir files or symlink, if the <tp> dir is writable
	- will add a ProtectedTest entry as needed, to simplify the setup of 
		serverconfig dataset entries in local dev ang github CI
*/

// export a function to allow reuse of this dataset without causing conflicts
// for the different use cases in runtime/tests
export default function (): Mds3 {
	return {
		isMds3: true,
		isSupportedChartOverride: {
			runChart: () => true,
			frequencyChart: () => true,
			report: () => true,
			summarizeMutationDiagnosis: () => true
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
											chartType: 'violin',
											settings: { violin: { showStats: false } },

											term: {
												id: 'agedx',
												q: { mode: 'continuous' }
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
											settings: { barchart: { colorBars: true, showPercent: true, colorUsing: 'present' } }
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
				},
				defaultTw4correlationPlot: {
					disease: { id: 'diaggrp', q: {} }
				}
			},
			scatterplots: {
				plots: [
					{
						name: 'TermdbTest TSNE',
						dimension: 2,
						file: 'files/hg38/TermdbTest/tsne.txt',
						colorTW: { id: 'diaggrp' },
						shapeTW: { id: 'sex' }
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
		},
		queries: {
			snvindel: {
				forTrack: true,
				byrange: {
					bcffile: 'files/hg38/TermdbTest/TermdbTest.bcf.gz',
					infoFields: [
						{
							name: 'Clinical Significance',
							key: 'CLNSIG',
							categories: {
								Pathogenic: {
									color: '#f04124',
									label: 'Pathogenic',
									desc: 'The variant is reported to be pathogenic.'
								},
								LP: {
									color: '#f024ce',
									label: 'Likely Pathogenic',
									desc: 'The variant is reported to be LP.'
								}
							},
							separator: '|'
						}
					]
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
				file: 'files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5',
				unit: 'FPKM'
			},
			ssGSEA: {
				file: 'files/hg38/TermdbTest/rnaseq/TermdbTest.ssgsea.h5'
			},
			topVariablyExpressedGenes: {
				src: 'native'
			},
			rnaseqGeneCount: {
				storage_type: 'HDF5',
				newformat: true,
				file: 'files/hg38/TermdbTest/rnaseq/TermdbTest.geneCounts.new.h5'
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
			},
			trackLst: {
				jsonFile: 'files/hg38/TermdbTest/trackLst/facet.json',
				activeTracks: ['bw 1', 'bed 1']
			}
		}
	} satisfies Mds3
}
