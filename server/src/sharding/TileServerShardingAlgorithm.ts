import serverconfig from '#src/serverconfig.js'
import ky from 'ky'
import type { ShardingAlgorithm } from '#src/sharding/ShardingAlgorithm.ts'
import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import { getShardIndex } from '#src/sharding/getShardIndex.ts'

export class TileServerShardingAlgorithm implements ShardingAlgorithm<TileServerShard> {
	public static readonly TILE_SERVER_SHARDING_KEY = 'TILE_SERVER_SHARDING_KEY'

	async getShard(key: string): Promise<TileServerShard> {
		const tileServerNodes = serverconfig.features?.tileserver.nodes || []
		const onlineCheck: boolean = serverconfig.features?.tileserver?.online_check || false
		const nodes: Array<TileServerShard> = []

		for (const node of tileServerNodes) {
			try {
				if (onlineCheck) {
					await ky.get(`${node.url}/tileserver/healthcheck`, { timeout: 600000 }).json()
				}
				nodes.push({
					url: node.url
				})
			} catch (error) {
				console.error(`Failed to connect to ${node.url}`, error)
			}
		}

		if (nodes.length === 0) {
			throw new Error('No available TileServer nodes. Please try later.')
		}

		const shardIndex = getShardIndex(key, nodes.length)

		return nodes[shardIndex]
	}
}
