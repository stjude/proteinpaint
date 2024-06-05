import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { illegalpath } from '#src/utils.js'

/*
return deep zoom image tiles
*/

const routePath = 'dzimages'

export const api: any = {
	endpoint: `${routePath}/:sampleId`,
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
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
		let imagePath
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = req.params.sampleId
			if (!sampleId) throw 'invalid sampleId'
			if (illegalpath(req.query.file)) throw `illegalpath filepath`

			const filename = path.basename(req.query.file)
			const allowedExtensions = ['.dzi', '.jpeg', '.png']
			const extension = path.extname(filename)

			if (!allowedExtensions.includes(extension)) {
				throw `Invalid file extension. Allowed extensions are ${allowedExtensions.join(', ')}`
			}

			imagePath = path.join(
				`${serverconfig.tpmasterdir}/${ds.queries.HnEImages.imageBySampleFolder}`,
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
