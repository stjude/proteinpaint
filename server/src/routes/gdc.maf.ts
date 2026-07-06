import type { RoutePayload, RouteApi } from '#types'
import type { GdcMafRequest, GdcMafResponse, GdcMafFile } from '#types'
import ky from 'ky'
import { joinUrl } from '#shared/joinUrl.js'
import serverconfig from '#src/serverconfig.js'
import { getGdcSampletypes } from '#src/mds3.gdc.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'GdcMafRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'GdcMafResponse' }
}

export const api: RouteApi = {
	endpoint: 'gdc/maf',
	methods: {
		get: payload,
		post: payload
	}
}

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

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			// g and ds are not used right now, but could be later
			const g = genomes.hg38
			if (!g) throw 'hg38 missing'
			const ds = g.datasets.GDC
			if (!ds) throw 'hg38 GDC missing'
			const q: GdcMafRequest = req.query
			const payload = await listMafFiles(q, ds)
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

/*
The GDC /files query, split out so listMafFiles can be unit-tested with an injected stub (no GDC/network)
— same pattern as gdc.mafBuild.ts. Returns the raw hits[] + total. Forwards the abort signal so a client
disconnect (app.middlewares.js sets q.__abortSignal for this route) can cancel a stalled request; ky's own
timeout stays off so the signal is the sole authority.
*/
export type MafFilesQuery = (
	host: any,
	headers: any,
	body: any,
	signal: AbortSignal | undefined
) => Promise<{ hits: any[]; total: number }>

const queryMafFiles: MafFilesQuery = async (host, headers, body, signal) => {
	const response = await ky.post(joinUrl(host.rest, 'files'), { headers, timeout: false, json: body, signal })
	if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
	const re: any = await response.json() // type any to avoid tsc err
	if (!Number.isInteger(re.data?.pagination?.total)) throw 're.data.pagination.total is not int'
	if (!Array.isArray(re.data?.hits)) throw 're.data.hits[] not array'
	return { hits: re.data.hits, total: re.data.pagination.total }
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
export async function listMafFiles(q: GdcMafRequest, ds: any, queryFiles: MafFilesQuery = queryMafFiles) {
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

	const body: any = {
		filters,
		size: maxFileNumber,
		fields: [
			'id',
			'file_size',
			'cases.project.project_id', // for display only
			'cases.case_id', // case uuid for making case url link to portal
			'cases.submitter_id', // used when listing all cases & files
			'cases.samples.tissue_type',
			'cases.samples.tumor_descriptor'
		].join(',')
	}
	if (case_filters.content.length) body.case_filters = case_filters

	// forwards q.__abortSignal so a client disconnect cancels the GDC request (see queryMafFiles)
	const { hits, total } = await queryFiles(host, headers, body, (q as any).__abortSignal)

	// flatten api return to table row objects
	// it is possible to set a max size limit to limit the number of files passed to client
	const files: GdcMafFile[] = []

	for (const h of hits) {
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
			    { tumor_descriptor: 'Recurrence', tissue_type: 'Tumor' },
  				{ tumor_descriptor: 'Not Applicable', tissue_type: 'Normal' }
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

		files.push({
			id: h.id,
			project_id: c.project.project_id,
			file_size: h.file_size,
			case_submitter_id: c.submitter_id,
			case_uuid: c.case_id,
			sample_types: getGdcSampletypes(c)
		} satisfies GdcMafFile)
	}

	// sort files in descending order of file size and show on table as default
	files.sort((a, b) => b.file_size - a.file_size)

	const result = {
		files,
		filesTotal: total,
		maxTotalSizeCompressed
	} satisfies GdcMafResponse

	return result
}
