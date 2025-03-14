import serverconfig from '#src/serverconfig.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.ts'
import { getShardIndex } from '#src/shardig/getShardIndex.ts'
import { RedisShard } from '#src/shardig/RedisShard.ts'
import RedisClientHolder from '#src/redis/RedisClientHolder.js'

export class RedisShardingAlgorithm implements ShardingAlgorithm<RedisShard> {
	public static readonly REDIS_SHARDING_KEY = 'REDIS_SHARDING_KEY'

	async getShard(key: string): Promise<RedisShard> {
		const redisNodes = serverconfig.features.redis_nodes || []

		const nodes: Array<RedisShard> = []

		for (const node of redisNodes) {
			if (node.secret && node.url) {
				const isOnline = await RedisClientHolder.getInstance().isNodeOnline(node.url) // Check if the node is online
				if (isOnline) {
					nodes.push(new RedisShard(node.url, node.secret))
				}
			}
		}

		if (nodes.length == 0) {
			return nodes[0]
		}

		const shardIndex = getShardIndex(key, nodes.length)

		return nodes[shardIndex]
	}
}
