const serverconfig = require('../src/serverconfig.js')
const fs = require('fs')
const path = require('path')

const cohorthtmltable = `<table>
<thead>
  <tr>
    <td>Features</td>
	<td>St. Jude Lifetime Cohort Study (SJLIFE)</td>
	<td>Childhood Cancer Survivor Study (CCSS)</td>
  </tr>
</thead>
<tbody>
  <tr>
    <td>Survivors on Portal</td>
	<td>4528</td>
	<td>2641</td>
  </tr>
  <tr>
	<td>Years of cancer diagnosis</td>
	<td>1962-2012</td>
	<td>1987-1999 ("Expanded Cohort")</td>
  </tr>
  <tr>
	<td>Inclusion criteria</td>
	<td>Survived &ge; 5 years from diagnosis</td>
	<td>Survived &ge; 5 years from diagnosis</td>
  </tr>
  <tr>
	<td>Age at cancer diagnosis</td>
	<td><25 years</td>
	<td><21 years</td>
  </tr>
  <tr>
	<td>Cancer diagnosis</td>
	<td>All diagnoses</td>
	<td>Leukemia, CNS, HL, NHL, neuroblastoma, soft tissue sarcoma, Wilms, bone tumors</td>
  </tr>
  <tr>
	<td>Study design</td>
	<td>Retrospective cohort with prospective follow-up, hospital-based</td>
	<td>Retrospective cohort with prospective follow-up, hospital-based</td>
  </tr>
  <tr>
	<td>Methods of contact</td>
	<td>Clinic visits and surveys</td>
	<td>Surveys</td>
  </tr>
  <tr>
	<td>Source of sequenced germline DNA</td>
	<td>Blood</td>
	<td>Saliva or blood</td>
  </tr>
  <tr>
	<td>Therapeutic exposures</td>
	<td>Chemotherapy, radiation, surgery</td>
	<td>Chemotherapy, radiation, surgery</td>
  </tr>
  <tr>
	<td>Methods for ascertainment of outcomes</td>
	<td><span style="font-weight:bold;text-decoration:underline">Clinical assessments<span>, medical records, self-report, NDI</td>
	<td>Self-report, pathology reports (secondary neoplasm), NDI</td>
  </tr>
</tbody>
</table>`

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
			coxCumincXlab: 'Years since study enrollment',

			selectCohort: {
				// wrap term.id into a term json object so as to use it in tvs;
				// the term is not required to exist in termdb
				// term.id is specific to this dataset, should not use literally in client/server code but always through a variable
				term: {
					id: 'subcohort',
					type: 'categorical'
				},
				showMessageWhenNotSelected:
					'To get started with the Clinical Browser, select the survivor population you wish to browse.',
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
				highlightCohortBy: 'cssSelector',
				htmlinfo: cohorthtmltable
			}
		}
	}
}

const datadir = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest')
if (!fs.existsSync(datadir)) fs.mkdirSync(datadir, { recursive: true }) // create missing path

const srcdb = path.join(serverconfig.binpath, 'test/testdata/db2')
const destdb = path.join(serverconfig.tpmasterdir, ds.cohort.db.file)
fs.copyFileSync(srcdb, destdb)

module.exports = ds
