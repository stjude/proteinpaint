import type { GetSampleWSImagesRequest, GetSampleWSImagesResponse, WSImage } from '#routeTypes/samplewsimages.js'

/*
given a sample, return all whole slide images for specified dataset
*/

export const api: any = {
	endpoint: 'samplewsimages',
	methods: {
		get: {
			init,
			request: {
				typeId: 'GetSampleWSImagesRequest'
			},
			response: {
				typeId: 'GetSampleWSImagesResponse'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query = req.query as GetSampleWSImagesRequest
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = query.sample_id

			const images = await ds.queries.WSImages.getWSImages({ sampleId })
			res.send({ sampleWSImages: images } as GetSampleWSImagesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}

export function validate_query_getSampleWSImages(ds: any, genome: any) {
	const q = ds.queries.WSImages
	if (!q) return
	nativeValidateQuery(ds)
}

function nativeValidateQuery(ds: any) {
	ds.queries.WSImages.getWSImages = async (q: any) => {
		return await getWSImages(ds, q.sampleId)
	}
}

async function getWSImages(ds: any, sampleName: string) {
	const sql = `SELECT wsimages.filename as filename, wsimages.metadata as metadata
                 FROM wsimages
                          INNER JOIN sampleidmap
                                     ON wsimages.sample = sampleidmap.id
                 WHERE sampleidmap.name = ?`

	const rows = ds.cohort.db.connection.prepare(sql).all(sampleName)
	const images: WSImage[] = []

	for (const row of rows) {
		images.push({
			filename: row.filename,
			metadata: row.metadata
		})
	}

	return images
}
