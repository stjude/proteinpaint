import type { RouteApi, WSImage, WSImagesRequest, WSImagesResponse } from '#types'
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
