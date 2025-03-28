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
			console.log('here')
			const images: WSImage[] = await ds.queries.WSImages.getWSImages(ds, sampleId, serverconfig.tpmasterdir)
			console.log(images)
			res.send({ sampleWSImages: images } satisfies SampleWSImagesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}

export async function validate_query_getSampleWSImages(ds: Mds3) {
	const q = ds.queries?.WSImages
	if (!q) return
	nativeValidateQuery(ds)
}

function nativeValidateQuery(ds: any) {
	if (!ds.queries.WSImages.getWSImages) {
		ds.queries.WSImages.getWSImages = async (dataset: any, sampleName: string) => {
			return await getWSImages(dataset, sampleName)
		}
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
