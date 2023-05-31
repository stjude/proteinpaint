'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
var path = require('path')
var serverconfig
try {
	serverconfig = require('../src/serverconfig')
} catch (e) {
	serverconfig = require('@sjcrh/proteinpaint-server/src/serverconfig')
}
var fs = require('fs')
/*
the "test mule" for the type of termdb dataset using server-side sqlite3 db
follows the mds3 specification
and is used to power many integration tests

- later the mds3 genomic/molecular stuff shoud be added to the mule
- to achieve complete coverage of mds3 features

to enable this dataset on your pp instance, have this entry in hg38 datasets array of your "serverconfig.json":

 { "name": "TermdbTest", "jsfile": "./dataset/termdb.test.js" }

files are hosted at specified locations under tp/
upon loading this script, directories under tp/ are auto-created if missing
data files already committed in the repo are copied over to tp/ locations for the dataset to work

reason:
- db2 file is anonymized and unindentifiable
- allow continuous integration test (future todo)
- ensure TermdbTest/db2 to be fully static and recoverable, to ensure tests work as expected

*/
copyDataFilesFromRepo2Tp()
exports.default = {
	isMds3: true,
	cohort: {
		db: {
			file: 'files/hg38/TermdbTest/db'
		},
		termdb: {
			displaySampleIds: true,
			minTimeSinceDx: 5,
			ageEndOffset: 0.00274,
			// for cox outcome with timeScale='age'
			// 1 day (i.e. 1/365 or 0.00274) needs to be added
			// to age_end to prevent age_end = age_start (which
			// would cause regression analysis to fail in R)
			coxTimeMsg: 'years since entry into the cohort',
			coxStartTimeMsg: 'begins at 5 years post cancer diagnosis',
			// term ids specific to dataset
			termIds: {
				ageDxId: 'agedx',
				ageLastVisitId: 'agelastvisit',
				ageNdiId: 'a_ndi',
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
						keys: ['ABC'],
						label: 'ABC Lifetime Cohort (ABC)',
						shortLabel: 'ABC',
						isdefault: true
					},
					{
						keys: ['XYZ'],
						label: 'XYZ Cancer Survivor Study (XYZ)',
						shortLabel: 'XYZ'
					},
					{
						keys: ['ABC', 'XYZ'],
						label: 'Combined ABC+XYZ',
						shortLabel: 'ABC+XYZ',
						// show note under label in smaller text size
						note:
							'The combined cohorts are limited to those variables that are comparable between the two populations. For example, selecting this category does not allow browsing of clinically-ascertained variables, which are only available in ABC.'
					}
				]
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
					name: 'TermdbTest TSNE',
					dimension: 2,
					file: 'files/hg38/TermdbTest/tnse.txt',
					colorTW: { id: 'diaggrp' }
				}
			]
		}
	}
}
function copyDataFilesFromRepo2Tp() {
	var targetDir = path.join(serverconfig.binpath, 'test/tp/files/hg38/TermdbTest')
	var datadir = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest')
	if (!targetDir.endsWith(datadir)) {
		if (fs.existsSync(datadir)) fs.unlinkSync(datadir)
		fs.symlinkSync(targetDir, datadir)
	}
}
