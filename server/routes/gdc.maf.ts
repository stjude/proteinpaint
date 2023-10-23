import { GdcMafResponse, File } from '#shared/types/routes/gdc.maf.ts'
import { fileSize } from '#shared/fileSize.js'
import path from 'path'
import got from 'got'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const maxFileNumber = 1000
const onlyAllowedWorkflowType = 'Aliquot Ensemble Somatic Variant Merging and Masking'

export const api = {
	endpoint: 'gdc/maf',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						const g = genomes.hg38
						if (!g) throw 'hg38 missing'
						const ds = g.datasets.GDC
						if (!ds) throw 'hg38 GDC missing'
						const files = await listMafFiles(req, ds)
						const payload = { files } as GdcMafResponse
						res.send(payload)
					} catch (e: any) {
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: null
				//valid: default to type checker
			},
			response: {
				typeId: 'GdcMafResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

/*
req.query {
	filter0 // optional gdc GFF cohort filter, invisible and read only
}

ds {
	__gdc {
		gdcOpenProjects
	}
}
*/
async function listMafFiles(req: any, ds: any) {
	const filters = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field: 'data_format', value: 'MAF' }
			}
		]
	}

	if (req.query.filter0) {
		filters.content.push(req.query.filter0)
	}

	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	const data = {
		filters,
		size: maxFileNumber,
		fields: [
			'id',
			'file_size',
			'access', // to limit to only open-access
			'experimental_strategy',
			'cases.project.project_id',
			'cases.submitter_id', // used when listing all cases & files
			'cases.samples.sample_type',
			'analysis.workflow_type' // to drop out those as skip_workflow_type
		].join(',')
	}

	const response = await got.post(path.join(apihost, 'files'), { headers, body: JSON.stringify(data) })

	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from ' + api.endpoint
	}
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
		  "access": open/controlled
		  "analysis": {
			"workflow_type": "MuSE Annotation"
		  },
		  "experimental_strategy": "Targeted Sequencing",
		  "file_size": 146038
		}
		*/

		if (typeof h.access != 'string') throw 'h.access value not string'
		if (h.access != 'open') continue // skip files that are not open

		const c = h.cases?.[0]
		if (!c) throw 'h.cases[0] missing'

		// only keep files from open access projects for now
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

		if (!h.analysis?.workflow_type) throw 'h.analysis.workflow_type missing'
		if (h.analysis.workflow_type != onlyAllowedWorkflowType) continue

		const file = {
			id: h.id,
			project_id: c.project.project_id,
			workflow_type: h.analysis?.workflow_type,
			experimental_strategy: h.experimental_strategy,
			file_size: fileSize(h.file_size)
		} as File

		file.case_submitter_id = c.submitter_id
		if (c.samples) {
			file.sample_types = c.samples.map(i => i.sample_type)
		}
		files.push(file)
	}
	return files
}
