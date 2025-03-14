import serverconfig from '#src/serverconfig.js'
import ky from 'ky'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.ts'
import { TileServerShard } from '#src/shardig/TileServerShard.ts'
import { getShardIndex } from '#src/shardig/getShardIndex.ts'

export class TileServerShardingAlgorithm implements ShardingAlgorithm<TileServerShard> {
	public static readonly TILE_SERVER_SHARDING_KEY = 'TILE_SERVER_SHARDING_KEY'

	async getShard(key: string): Promise<TileServerShard> {
		const tileServerNodes = serverconfig.features.tileserver_nodes || []

		const nodes: Array<TileServerShard> = []

		for (const node of tileServerNodes) {
			try {
				await ky.get(`${node.url}/tileserver/healthcheck`, { timeout: 600000 }).json()
				nodes.push(new TileServerShard(node.url, node.mount))
			} catch (error) {
				console.error(`Failed to connect to ${node.url}`, error)
			}
		}

		if (nodes.length === 0) {
			throw new Error('No available TileServer nodes')
		}

		const shardIndex = getShardIndex(key, nodes.length)

		return nodes[shardIndex]
	}
}
