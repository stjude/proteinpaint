import type { TileRequest /*, TileResponse*/, RouteApi } from '#types'
import { tilePayload } from '#types/checkers'
import ky from 'ky'
import { TileServerShard } from '#src/shardig/TileServerShard.js'
import { TileServerShardingAlgorithm } from '#src/shardig/TileServerShardingAlgorithm.js'
import { ShardManager } from '#src/shardig/ShardManager.js'

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
	return async (req: any, res: any): Promise<void> => {
		try {
			const { sampleId, TileGroup, z, x, y } = req.params satisfies TileRequest

			const wsiImage = req.query.wsi_image

			if (!wsiImage) throw new Error('Invalid wsi_image')

			const shardManager = ShardManager.getInstance()
			const tileServer: TileServerShard = await shardManager.shardingAlgorithmsMap
				?.get(TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY)
				?.getShard(wsiImage)

			if (!tileServer) {
				throw new Error('No tile server')
			}

			const url = `${tileServer.url}/tileserver/layer/slide/${sampleId}/zoomify/${TileGroup}/${z}-${x}-${y}@1x.jpg`

			const response = await ky.get(url, { timeout: 120000 })

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
