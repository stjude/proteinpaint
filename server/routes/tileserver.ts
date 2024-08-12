import ky from 'ky'
import serverconfig from '#src/serverconfig.js'

const routePath = 'tileserver'

export const api: any = {
	endpoint: `${routePath}/layer/slide/:sampleId/zoomify/:TileGroup/:z-:x-:y@1x.jpg`,
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

function init() {
	return async (req: any, res: any): Promise<void> => {
		try {
			const { sampleId, TileGroup, z, x, y } = req.params

			const url = `${serverconfig.tileServerURL}/tileserver/layer/slide/${sampleId}/zoomify/${TileGroup}/${z}-${x}-${y}@1x.jpg`

			const response = await ky.get(url)

			const buffer = await response.arrayBuffer()
			res.status(response.status).send(Buffer.from(buffer))
		} catch (error: any) {
			if (error.response) {
				const errorBody = await error.response.arrayBuffer()
				res.status(error.response.status).send(Buffer.from(errorBody))
			} else {
				res.status(500).send('Internal Server Error')
			}
		}
	}
}
