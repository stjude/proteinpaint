/*
this script is hosted at https://proteinpaint.stjude.org/GDC/listCaseWithBams.js

examples:

node listCaseWithBams.cjs // list all cases

node listCaseWithBams.cjs '{"op":"and","content":[{"op":"in","content":{"field":"cases.primary_site","value":["breast","bronchus and lung"]}}]}' // using a cohort

*/

const got = require('got')
const path = require('path')

const apihost = 'https://api.gdc.cancer.gov'

/************************************************
following part is copied from bam.gdc.js (lines 63 to the end)
*/

// used in getFileByCaseId() and getFileByCaseId()
const filesApi = {
	end_point: path.join(apihost, 'files/'),
	fields: [
		'file_size',
		'experimental_strategy',
		'cases.submitter_id',
		'cases.samples.sample_type',
		'analysis.workflow_type' // to drop out those as skip_workflow_type
	],
	size: 100
}

const skip_workflow_type = 'STAR 2-Pass Transcriptome'

async function getCaseFiles(filter0) {
	const filter = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field: 'data_category', value: 'Sequencing Reads' }
			},
			// wendy's method to limit to bam files that are indexed
			{
				op: '=',
				content: { field: 'index_files.data_format', value: 'bai' }
			},
			{
				op: '=',
				content: { field: 'data_type', value: 'Aligned Reads' }
			},
			{
				op: '=',
				content: { field: 'data_format', value: 'bam' }
			}
		]
	}

	if (filter0) {
		filter.content.push(filter0)
	}

	return await queryApi(filter, filesApi)
}

// helper to query api
async function queryApi(filters, api) {
	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	const data = {
		filters,
		size: 200,
		fields: api.fields.join(',')
	}

	const response = await got(api.end_point, { method: 'POST', headers, body: JSON.stringify(data) })

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from ' + api.end_point
	}
	if (!re.data || !re.data.hits) throw 'data structure not data.hits[]'
	return re
}

/************************************************
above part is copied from bam.gdc.js
*/

const filter0 = process.argv[2]

;(async () => {
	try {
		let f
		if (filter0) {
			f = JSON.parse(filter0)
		}

		const re = await getCaseFiles(f)
		/*
		{
		  data{
		    hits[
			  {
		      }
			]
		  }
		}

		each hit:

{
  "id": "cb77b4ab-b52c-48cb-b8a6-9285ed960877",
  "cases": [
    {
      "submitter_id": "TCGA-VS-A9UD",
      "samples": [
        {
          "sample_type": "Primary Tumor"
        }
      ]
    }
  ],
  "analysis": {
    "workflow_type": "STAR 2-Pass Genome"
  },
  "experimental_strategy": "RNA-Seq",
  "file_size": 2850294384
}

		*/

		for (const h of re.data.hits) {
			if (h.analysis.workflow_type == skip_workflow_type) {
				console.log('skipped 1')
				continue
			}

			console.log('case', h.cases[0].submitter_id)
			console.log('file_uuid', h.id)
			console.log('sample_type', h.cases[0].samples[0].sample_type)
			console.log('experiment', h.experimental_strategy)
			console.log('size', h.file_size)
		}
		console.log('loaded', re.data.hits.length)
		console.log('total # files', re.data.pagination.total)
	} catch (e) {
		console.log('ERROR: ' + (e.message || e))
	}
})()
