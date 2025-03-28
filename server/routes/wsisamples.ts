import type { Mds3, RouteApi, WSImage, WSImagesRequest, WSImagesResponse } from '#types'
import { WSISample, wsiSamplesPayload, WSISamplesResponse } from '@sjcrh/proteinpaint-types/routes/wsisamples.ts'
import serverconfig from '#src/serverconfig.js'

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

			const images: WSISample[] = await ds.queries.WSImages.getSamples(ds, serverconfig.tpmasterdir)

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
	nativeValidateQuery(ds)
}

function nativeValidateQuery(ds: any) {
	if (!ds.queries.WSImages.getSamples) {
		ds.queries.WSImages.getSamples = async (dataset: any) => {
			return await getSamples(dataset)
		}
	}
}

async function getSamples(ds: any): Promise<WSISample[]> {
	const sql = `SELECT filename, sample FROM wsimages`
	try {
		const rows = ds.cohort.db.connection.prepare(sql).all()
		const sampleMap: { [key: string]: WSISample } = {}

		for (const row of rows) {
			if (!sampleMap[row.sample]) {
				sampleMap[row.sample] = { sampleId: row.sample, wsimages: [] }
			}
			sampleMap[row.sample].wsimages.push(row.filename)
		}

		return Object.values(sampleMap)
	} catch (error) {
		console.error('Error fetching samples:', error)
		throw error
	}
}
