import path from 'path'
import serverconfig from '#src/serverconfig.js'

/*
return deep zoom image tiles
*/

const routePath = 'dzimages'

export const api: any = {
	endpoint: `${routePath}/*`,
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

			imagePath = path.join(
				`${serverconfig.tpmasterdir}/${ds.queries.HnEImages.samples}`,
				req.path.split(`/${routePath}`)[1]
			)
		} catch (e: any) {
			console.log(e)
		}

		res.sendFile(imagePath, (err: any) => {
			if (err) {
				res.status(404).send('Image not found')
			}
		})
	}
}
