import type { SampleWSImagesRequest, SampleWSImagesResponse, WSImage, RouteApi, Mds3 } from '#types'
import { sampleWSImagesPayload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
/*
given a sample, return all whole slide images for specified dataset
*/

export const api: RouteApi = {
	endpoint: 'samplewsimages',
	methods: {
		get: {
			...sampleWSImagesPayload,
			init
		},
		post: {
			...sampleWSImagesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: SampleWSImagesRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = query.sample_id

			const images: WSImage[] = await ds.queries.WSImages.getWSImages(ds, sampleId, serverconfig.tpmasterdir)
			res.send({ sampleWSImages: images } satisfies SampleWSImagesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}
