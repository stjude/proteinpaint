import serverconfig from '#src/serverconfig.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.ts'
import { getShardIndex } from '#src/shardig/getShardIndex.ts'
import { RedisShard } from '#src/shardig/RedisShard.ts'

export class RedisShardingAlgorithm implements ShardingAlgorithm<RedisShard> {
	public static readonly REDIS_SHARDING_KEY = 'REDIS_SHARDING_KEY'

	getShard(key: string): RedisShard {
		const redisNodes = serverconfig.features.redis_nodes || []

		const nodes: Array<RedisShard> = []

		redisNodes.forEach((node: { secret: string; url: string }) => {
			if (node.secret && node.url) {
				// TODO check if node is online
				nodes.push(new RedisShard(node.url, node.secret))
			}
		})
		if (nodes.length == 0) {
			return nodes[0]
		}

		const shardIndex = getShardIndex(key, nodes.length)

		return nodes[shardIndex]
	}
}
