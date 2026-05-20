import type { TileRequest /*, TileResponse*/, RouteApi } from '#types'
import { tilePayload } from '#types/checkers'
import ky from 'ky'
import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import { TileServerShardingAlgorithm } from '#src/sharding/TileServerShardingAlgorithm.ts'
import { ShardManager } from '#src/sharding/ShardManager.ts'
import SessionManager from '#src/wsisessions/SessionManager.ts'
import serverconfig from '#src/serverconfig.js'
import path from 'path'

export const api: RouteApi = {
	endpoint: `tileserver/layer/:type/:sessionId/zoomify/:TileGroup/:z-:x-:y@1x.jpg`,
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

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const { type, sessionId, TileGroup, z, x, y } = req.params satisfies TileRequest
			const query = req.query
			const wsiImage = query.wsi_image
			if (!wsiImage) throw new Error('No wsi_image param provided')
			const dslabel = query.dslabel
			if (!dslabel) throw new Error('No dslabel param provided')
			const g = genomes[query.genome]
			if (!g) throw new Error('Invalid genome name')
			const ds = g.datasets[query.dslabel]
			if (!ds) throw new Error('Invalid dataset name')
			const sampleId = query.sample_id
			const projectId = query.ai_project_id
			if (!sampleId && !projectId) throw new Error('Either sample_id or project_id must be provided')

			const mount = serverconfig.features?.tileserver?.mount
			if (!mount) throw new Error('No mount available for TileServer')

			let wsiImagePath: string

			//  TODO try to simplify this logic here and everywhere else
			if (sampleId) {
				wsiImagePath = path.join(`${mount}/${ds.queries.WSImages.imageBySampleFolder}/${sampleId}`, wsiImage)
			} else {
				wsiImagePath = path.join(`${mount}/${ds.queries.WSImages.aiToolImageFolder}/`, wsiImage)
			}

			if (!wsiImage) throw new Error('Invalid wsi_image')

			const shardManager = ShardManager.getInstance()
			const tileServer: TileServerShard = await shardManager.shardingAlgorithmsMap
				?.get(TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY)
				?.getShard(wsiImagePath)

			if (!tileServer) {
				throw new Error('No tile server')
			}

			const url = `${tileServer.url}/tileserver/layer/${type}/${sessionId}/zoomify/${TileGroup}/${z}-${x}-${y}@1x.jpg`

			const response = await ky.get(url, { timeout: 120000 })

			await SessionManager.getInstance().updateSession(wsiImagePath)

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
