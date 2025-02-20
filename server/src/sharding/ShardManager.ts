import serverconfig from '#src/serverconfig.js'
import { ShardingAlgorithm } from '#src/sharding/ShardingAlgorithm.ts'
import { TileServerShardingAlgorithm } from '#src/sharding/TileServerShardingAlgorithm.ts'
import { RedisShardingAlgorithm } from '#src/sharding/RedisShardingAlgorithm.ts'

export class ShardManager {
	private static instance: ShardManager | undefined
	public shardingAlgorithmsMap: Map<string, ShardingAlgorithm<any>>

	private constructor(map: Map<string, ShardingAlgorithm<any>>) {
		this.shardingAlgorithmsMap = map
	}

	public static getInstance(): ShardManager {
		if (!ShardManager.instance) {
			const map = new Map<string, ShardingAlgorithm<any>>()

			if (serverconfig.features?.tileserver?.nodes) {
				const shardingAlgorithm = new TileServerShardingAlgorithm()

				map.set(TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY, shardingAlgorithm)
			}

			if (serverconfig.features?.redis?.nodes) {
				const shardingAlgorithm = new RedisShardingAlgorithm()

				map.set(RedisShardingAlgorithm.REDIS_SHARDING_KEY, shardingAlgorithm)
			}

			ShardManager.instance = new ShardManager(map)
		}
		return ShardManager.instance
	}
}
