import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

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
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = req.query.sample_id

			const sampleWSImagesPath = path.join(
				`${serverconfig.tpmasterdir}/${ds.queries.WSImages.imageBySampleFolder}`,
				sampleId
			)

			const sampleWSImages = await getWSImages(sampleWSImagesPath)
			res.send({ sampleWSImages: sampleWSImages })
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}

async function getWSImages(sampleImagesPath: string): Promise<string[]> {
	const files = await fs.promises.readdir(sampleImagesPath)
	return files.filter(file => ['.svs', '.mrxs', '.scn', '.ndpi', '.tiff'].includes(path.extname(file)))
}
