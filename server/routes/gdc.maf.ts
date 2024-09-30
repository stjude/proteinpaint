import type { GdcMafRequest, GdcMafResponse, File } from '#routeTypes/gdc.maf.ts'
import path from 'path'
import got from 'got'
import serverconfig from '#src/serverconfig.js'

/*
this route lists available gdc MAF files based on user's cohort filter
and return them to client to be shown in a table for selection
*/

const maxFileNumber = 1000 // determines max number of files to return to client
// preliminary testing:
// 36s for 1000 (87Mb)
// 78s for 2000 (177Mb)
// if safe to increase to 2000, maybe fast when this runs in gdc env

const allowedWorkflowType = 'Aliquot Ensemble Somatic Variant Merging and Masking'

// change to 400 so it won't limit number of files; should keep this setting as a safeguard; also it's fast to check file size (.5s in gdc.mafBuild.ts)
export const maxTotalSizeCompressed = serverconfig.features.gdcMafMaxFileSize || 400000000 // 400Mb

export const api = {
	endpoint: 'gdc/maf',
	methods: {
		all: {
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

			const payload = await listMafFiles(req.query as GdcMafRequest, ds)
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
async function listMafFiles(q: GdcMafRequest, ds: any) {
	const filters = {
		op: 'and',
		content: [
			{ op: '=', content: { field: 'data_format', value: 'MAF' } },
			{ op: '=', content: { field: 'experimental_strategy', value: q.experimentalStrategy } },
			{ op: '=', content: { field: 'analysis.workflow_type', value: allowedWorkflowType } },
			{ op: '=', content: { field: 'access', value: 'open' } } // delete if later to support controlled files
		]
	}
	const case_filters: any = { op: 'and', content: [] }
	if (q.filter0) {
		case_filters.content.push(q.filter0)
	}

	const { host, headers } = ds.getHostHeaders(q)

	const data: any = {
		filters,
		size: maxFileNumber,
		fields: [
			'id',
			'file_size',
			'cases.project.project_id', // for display only
			'cases.case_id', // case uuid for making case url link to portal
			'cases.submitter_id', // used when listing all cases & files
			'cases.samples.sample_type'
			// may add diagnosis and primary site
		].join(',')
	}
	if (case_filters.content.length) data.case_filters = case_filters

	const response = await got.post(path.join(host.rest, 'files'), { headers, body: JSON.stringify(data) })

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
			file_size: h.file_size,
			case_submitter_id: c.submitter_id,
			case_uuid: c.case_id
		} as File

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
