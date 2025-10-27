import type { Mds3, RouteApi, WSImagesRequest, WSISample, WSISamplesResponse } from '#types'
import { wsiSamplesPayload } from '#types/checkers'

const routePath = 'wsisamples'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			...wsiSamplesPayload,
			init
		},
		post: {
			...wsiSamplesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: WSImagesRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw new Error('Invalid genome name')
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'Invalid dslabel'

			const images: WSISample[] = await ds.queries.WSImages.getSamples() // TODO use cohort filter as arg

			const payload: WSISamplesResponse = {
				samples: images
			}

			res.status(200).json(payload)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}

export async function validate_query_getWSISamples(ds: Mds3) {
	const q = ds.queries?.WSImages
	if (!q) return
	validateQuery(ds)
}

function validateQuery(ds: any) {
	if (typeof ds.queries.WSImages.getSamples == 'function') {
		// ds supplied
		return
	}
	// add getter with built in logic
	ds.queries.WSImages.getSamples = async () => {
		const sql = `SELECT wsimages.sample as sample, wsimages.filename as filename, wsimages.metadata as metadata, sampleidmap.name as sampleName
					 FROM wsimages
					 INNER JOIN sampleidmap
					 ON wsimages.sample = sampleidmap.id`
		try {
			const rows = ds.cohort.db.connection.prepare(sql).all()
			const sampleMap: { [key: string]: WSISample } = {}

			for (const row of rows) {
				if (!sampleMap[row.sample]) {
					sampleMap[row.sample] = { sampleId: row.sampleName, wsimages: [] }
				}
				sampleMap[row.sample].wsimages.push(row.filename)
			}

			return Object.values(sampleMap)
		} catch (error) {
			console.error('Error fetching samples:', error)
			throw error
		}
	}
}
