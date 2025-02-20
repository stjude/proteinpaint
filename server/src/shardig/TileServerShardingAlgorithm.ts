import serverconfig from '#src/serverconfig.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.ts'
import { TileServerShard } from '#src/shardig/TileServerShard.ts'
import { getShardIndex } from '#src/shardig/getShardIndex.ts'

export class TileServerShardingAlgorithm implements ShardingAlgorithm<TileServerShard> {
	public static readonly TILE_SERVER_SHARDING_KEY = 'TILE_SERVER_SHARDING_KEY'

	getShard(key: string): TileServerShard {
		const tileServerNodes = serverconfig.features.tileserver_nodes || []

		const nodes: Array<TileServerShard> = []

		tileServerNodes.forEach(node => {
			if (node.mount && node.url) {
				// TODO check if node is online
				nodes.push(new TileServerShard(node.url, node.mount))
			}
		})
		if (nodes.length == 0) {
			return nodes[0]
		}

		const shardIndex = getShardIndex(key, nodes.length)

		return nodes[shardIndex]
	}
}
