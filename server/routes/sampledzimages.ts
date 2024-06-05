import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

/*
given a sample, return all deep zoom images for specified dataset
*/

export const api: any = {
	endpoint: 'sampledzimages',
	methods: {
		get: {
			init,
			request: {
				typeId: 'GetSampleDZImagesRequest'
			},
			response: {
				typeId: 'GetSampleDZImagesResponse'
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

			const sampleDZImagesPath = path.join(
				`${serverconfig.tpmasterdir}/${ds.queries.DZImages.imageBySampleFolder}`,
				sampleId
			)
			const sampleDZImages = getDZImages(sampleDZImagesPath)
			res.send({ sampleDZImages })
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}

function getDZImages(sampleImagesPath: string): string[] {
	const files = fs.readdirSync(sampleImagesPath)
	return files.filter(file => path.extname(file) === '.dzi')
}
