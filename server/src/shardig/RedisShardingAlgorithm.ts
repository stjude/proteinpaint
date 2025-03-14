import serverconfig from '#src/serverconfig.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.ts'
import { getShardIndex } from '#src/shardig/getShardIndex.ts'
import { RedisShard } from '#src/shardig/RedisShard.ts'
import RedisClientHolder from '#src/redis/RedisClientHolder.js'

export class RedisShardingAlgorithm implements ShardingAlgorithm<RedisShard> {
	public static readonly REDIS_SHARDING_KEY = 'REDIS_SHARDING_KEY'

	async getShard(key: string): Promise<RedisShard> {
		const redisNodes = serverconfig.features?.redis?.nodes || []
		const onlineCheck: boolean = serverconfig.features?.tileserver?.online_check || false

		if (redisNodes.length < 0) throw new Error('No available Redis nodes')

		const nodes: Array<RedisShard> = []

		for (const node of redisNodes) {
			if (node.secret && node.url) {
				let addNode = true

				if (onlineCheck) {
					addNode = await RedisClientHolder.getInstance().isNodeOnline(node.url)
				}

				if (addNode) {
					nodes.push(new RedisShard(node.url, node.secret))
				}
			}
		}

		if (nodes.length === 0) {
			throw new Error('No Redis nodes available, please try later.')
		}

		if (nodes.length == 1) {
			return nodes[0]
		}

		const shardIndex = getShardIndex(key, nodes.length)

		return nodes[shardIndex]
	}
}
