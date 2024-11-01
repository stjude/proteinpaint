import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { DZImagesRequest, DZImagesResponse, RouteApi } from '#types'
import { dzImagesPayload } from '#types'

/*
given a sample, return all deep zoom images for specified dataset
*/

export const api: RouteApi = {
	endpoint: 'sampledzimages',
	methods: {
		get: {
			init,
			...dzImagesPayload
		},
		post: {
			init,
			...dzImagesPayload
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: DZImagesRequest = req.query
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = q.sample_id || ''

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
