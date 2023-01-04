const serverconfig = require('../src/serverconfig.js')
const fs = require('fs')
const path = require('path')

/*
this will automatically create path under tp/ if missing,
and copy over the sqlite db file from repo to tp/ path

reason:
- db2 file is anonymized and unindentifiable
- allow continuous integration test (future todo)
- ensure TermdbTest/db2 to be fully static and recoverable, to ensure tests work as expected

to enable this dataset on your pp instance, have this entry in hg38 datasets array of your "serverconfig.json":

 { "name": "TermdbTest", "jsfile": "./dataset/termdb.test.js" }

test with survival plot:

http://localhost:3000/?noheader=1&mass={"dslabel":"TermdbTest","genome":"hg38","plots":[{"chartType":"survival","term2":{"id":"diaggrp"},"term":{"id":"efs"}}]}

(this ensures better-sqlite3 and R works on your pp instance)
*/

module.exports = function() {
	const ds = {
		isMds: true,
		cohort: {
			db: {
				file: 'files/hg38/TermdbTest/db2'
			},
			termdb: {
				survivalplot: {
					term_ids: ['efs', 'os'],
					xUnit: 'years',
					codes: [{ value: 0, name: '' }, { value: 1, name: 'censored' }]
				},

				minTimeSinceDx: 5, // enrollment in sjlife requires 5 years since cancer diagnosis

				ageStartTermId: 'agedx', // term id for starting age of patients
				// for cox outcome with timeScale='age'
				// starting age of patients is age at cancer diagnosis

				ageEndOffset: 0.00274, // number of years to offset ending age of patients
				// for cox outcome with timeScale='age'
				// 1 day (i.e. 1/365 or 0.00274) needs to be added
				// to age_end to prevent age_end = age_start (which
				// would cause regression analysis to fail in R)

				// term ids specific to dataset
				termIds: {
					ageDxId: 'agedx', // age at diagnosis
					ageLastVisitId: 'agelastvisit', // age at last visit
					ageNdiId: 'a_ndi', // age at last NDI seach
					ageDeathId: 'a_death' // age at death
				},

				selectCohort: {
					// wrap term.id into a term json object so as to use it in tvs;
					// the term is not required to exist in termdb
					// term.id is specific to this dataset, should not use literally in client/server code but always through a variable
					term: {
						id: 'subcohort',
						type: 'categorical'
					},
					prompt: 'To get started with the Clinical Browser, select the survivor population you wish to browse.',
					values: [
						// <ul><li> for items, with a radio button for each.
						{
							keys: ['SJLIFE'],
							label: 'St. Jude Lifetime Cohort (SJLIFE)',
							shortLabel: 'SJLIFE',
							isdefault: true,
							cssSelector: 'tbody > tr > td:nth-child(2)'
						},
						{
							keys: ['CCSS'],
							label: 'Childhood Cancer Survivor Study (CCSS)',
							shortLabel: 'CCSS',
							cssSelector: 'tbody > tr > td:nth-child(3)'
						},
						{
							keys: ['SJLIFE', 'CCSS'],
							label: 'Combined SJLIFE+CCSS',
							shortLabel: 'SJLIFE+CCSS',
							cssSelector: 'tbody > tr > td:nth-child(2), tbody > tr > td:nth-child(3)',
							// show note under label in smaller text size
							note:
								'The combined cohorts are limited to those variables that are comparable between the two populations. For example, selecting this category does not allow browsing of clinically-ascertained variables, which are only available in SJLIFE.'
						}
					],
					highlightCohortBy: 'cssSelector'
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
				}
			},
			scatterplots: {
				plots: [
					{
						name: 'Methylome TSNE',
						dimension: 2,
						file: 'files/hg38/TermdbTest/tnse.txt',
						term: { id: 'diaggrp' }
					}
				]
			}
		}
	}

	const targetDir = path.join(serverconfig.binpath, 'test/tp/files/hg38/TermdbTest')
	const datadir = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest')

	if (!targetDir.endsWith(datadir) && !fs.existsSync(datadir)) {
		fs.symlinkSync(targetDir, datadir)
	}

	return ds
}
