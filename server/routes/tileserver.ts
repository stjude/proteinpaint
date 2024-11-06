import type { TileRequest /*, TileResponse*/, RouteApi } from '#types'
import { tilePayload } from '#types'
import ky from 'ky'
import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: `tileserver/layer/slide/:sampleId/zoomify/:TileGroup/:z-:x-:y@1x.jpg`,
	methods: {
		get: {
			...tilePayload,
			init
		},
		post: {
			...tilePayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const { sampleId, TileGroup, z, x, y } = req.params satisfies TileRequest

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
