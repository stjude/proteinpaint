import { GdcMafResponse, File } from '#shared/types/routes/gdc.maf.ts'
import { fileSize } from '#shared/fileSize.js'
import path from 'path'
import got from 'got'

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'

export const api = {
	endpoint: 'gdc/maf',
	methods: {
		get: {
			init({ genomes }) {
				// genomes parameter is not used
				// could be used later to verify hg38/GDC is on this instance and otherwise disable this route..

				return async (req: any, res: any): Promise<void> => {
					try {
						const files = await listMafFiles(req)
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
*/
async function listMafFiles(req: any) {
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
		size: 1000,
		fields: [
			'id',
			'file_size',
			'experimental_strategy',
			'cases.submitter_id', // used when listing all cases & files
			//'associated_entities.entity_submitter_id', // semi human readable
			//'associated_entities.case_id', // case uuid
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
		const file = {
			id: h.id,
			workflow_type: h.analysis?.workflow_type,
			experimental_strategy: h.experimental_strategy,
			file_size: fileSize(h.file_size)
		} as File
		const c = h.cases?.[0]
		if (c) {
			file.case_submitter_id = c.submitter_id
			if (c.samples) {
				file.sample_types = c.samples.map(i => i.sample_type).join(', ')
			}
		}
		files.push(file)
	}
	return files
}
