import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { illegalpath } from '#src/utils.js'
import type { DZImagesRequest, DZImagesResponse, RouteApi } from '#types'
import { dzImagesPayload } from '#types'

/*
return .dzi file and deep zoom image tiles for specified sample and dataset
*/

export const api: RouteApi = {
	endpoint: `dzimages/:sampleId`,
	methods: {
		get: {
			...dzImagesPayload,
			init
		},
		post: {
			...dzImagesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: DZImagesRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = q.sampleId
			if (!sampleId) throw 'invalid sampleId'
			if (illegalpath(req.query.file)) throw `illegalpath filepath`

			const filename = path.basename(q.file)
			const allowedExtensions = ['.dzi', '.jpeg', '.png']
			const extension = path.extname(filename)

			if (!allowedExtensions.includes(extension)) {
				throw `Invalid file extension. Allowed extensions are ${allowedExtensions.join(', ')}`
			}

			const imagePath: DZImagesResponse = path.join(
				`${serverconfig.tpmasterdir}/${ds.queries.DZImages.imageBySampleFolder}`,
				`${sampleId}/${req.query.file}`
			)

			res.sendFile(imagePath, (err: any) => {
				if (err) {
					res.status(404).send('Image not found')
				}
			})
		} catch (e: any) {
			console.log(e)
			res.send({
				status: 'error',
				error: e.error || e
			})
		}
	}
}
