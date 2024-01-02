import { GdcMafRequest, GdcMafResponse, File } from '#shared/types/routes/gdc.maf.ts'
import path from 'path'
import got from 'got'
import serverconfig from '#src/serverconfig.js'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const maxFileNumber = 2000
const allowedWorkflowType = 'Aliquot Ensemble Somatic Variant Merging and Masking'
const maxTotalSizeCompressed = serverconfig.features.gdcMafMaxFileSize || 100000000 // 100Mb

export const api = {
	endpoint: 'gdc/maf',
	methods: {
		get: {
			init,
			request: {
				typeId: 'GdcMafRequest'
			},
			response: {
				typeId: 'GdcMafResponse'
				// will combine this with type checker
				//valid: (t) => {}
			},
			examples: [
				{
					request: {
						body: {
							experimentalStrategy: 'WXS',
							embedder: 'localhost'
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			// g and ds are not used right now, but could be later
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'

			const payload = await listMafFiles(req.query as GdcMafRequest)
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

/*
req.query {
	filter0 // optional gdc GFF cohort filter, invisible and read only
	experimentalStrategy: WXS/Targeted Sequencing
}

ds {
	__gdc {
		gdcOpenProjects
	}
}
*/
async function listMafFiles(q: GdcMafRequest) {
	const filters = {
		op: 'and',
		content: [
			{ op: '=', content: { field: 'data_format', value: 'MAF' } },
			{ op: '=', content: { field: 'experimental_strategy', value: q.experimentalStrategy } },
			{ op: '=', content: { field: 'analysis.workflow_type', value: allowedWorkflowType } },
			{ op: '=', content: { field: 'access', value: 'open' } } // delete if later to support controlled files
		]
	}

	if (q.filter0) {
		filters.content.push(q.filter0)
	}

	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	const data = {
		filters,
		size: maxFileNumber,
		fields: [
			'id',
			'file_size',
			'cases.project.project_id', // for display only
			'cases.submitter_id', // used when listing all cases & files
			'cases.samples.sample_type'
			// may add diagnosis and primary site
		].join(',')
	}

	const response = await got.post(path.join(apihost, 'files'), { headers, body: JSON.stringify(data) })

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from ' + api.endpoint
	}
	if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total is not int'
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'

	// flatten api return to table row objects
	// it is possible to set a max size limit to limit the number of files passed to client
	const files = [] as File[]

	for (const h of re.data.hits) {
		/*
		{
		  "id": "39768777-fec5-4a79-9515-65712c002b19",
		  "cases": [
			{
			  "submitter_id": "HTMCP-03-06-02104",
			  "project": {
			  	"project_id":"xx"
			  },
			  "samples": [
				{
				  "sample_type": "Blood Derived Normal"
				},
				{
				  "sample_type": "Primary Tumor"
				}
			  ]
			}
		  ],
		  "analysis": {
			"workflow_type": "MuSE Annotation"
		  },
		  "experimental_strategy": "Targeted Sequencing",
		  "file_size": 146038
		}
		*/

		const c = h.cases?.[0]
		if (!c) throw 'h.cases[0] missing'

		// only keep files from open access projects for now
		/*
		if (c.project?.project_id) {
			if (ds.__gdc.gdcOpenProjects.has(c.project.project_id)) {
				// open-access project, keep
			} else {
				// not open access
				continue
			}
		} else {
			throw 'h.cases[0].project.project_id missing'
		}
		*/

		const file = {
			id: h.id,
			project_id: c.project.project_id,
			file_size: h.file_size
		} as File

		file.case_submitter_id = c.submitter_id
		if (c.samples) {
			file.sample_types = c.samples.map((i: { sample_type: any }) => i.sample_type).sort()
			// sort to show sample type names in consistent alphabetical order
			// otherwise one file shows 'Blood, Primary' and another shows 'Primary, Blood'
			// FIXME this includes samples not associated with current maf file
		}
		files.push(file)
	}

	const result = {
		files,
		filesTotal: re.data.pagination.total,
		maxTotalSizeCompressed
	} as GdcMafResponse

	return result
}
