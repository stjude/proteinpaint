import { createClient, RedisClientType } from 'redis'
import serverconfig from '#src/serverconfig.js'
import { RedisShard } from '#src/shardig/RedisShard.js'
import { ShardManager } from '#src/shardig/ShardManager.js'
import { RedisShardingAlgorithm } from '#src/shardig/RedisShardingAlgorithm.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.js'
import { SessionData } from '#src/wsisessions/SessionManager.js'
import { TileServerShard } from '#src/shardig/TileServerShard.js'
import * as console from 'node:console'

export default class RedisClientHolder {
	private static instance: RedisClientHolder = new RedisClientHolder()
	private clients: Map<string, RedisClientType> = new Map()
	private shardManager = ShardManager.getInstance()
	private redisShardingAlgorithm: ShardingAlgorithm<any> | undefined = this.shardManager.shardingAlgorithmsMap.get(
		RedisShardingAlgorithm.REDIS_SHARDING_KEY
	)

	private constructor() {
		const redisNodes = serverconfig.features.redis_nodes || []

		for (const redisNode of redisNodes) {
			const redisUrl = redisNode.url
			const secret = redisNode.secret

			const client: RedisClientType = createClient({
				url: redisUrl,
				password: secret
			})

			client.on('error', (err: any) => {
				console.error('Redis Client Error at', redisUrl, ':', err)
			})

			client.on('connect', () => {
				console.log('Redis client connected at', redisUrl)
			})

			client.on('ready', () => {
				console.log('Redis client ready at', redisUrl)
			})

			client.connect()
			this.clients.set(redisNode.url, client)
		}
	}

	public static getInstance(): RedisClientHolder {
		let instance = RedisClientHolder.instance
		if (!instance) {
			instance = new RedisClientHolder()
		}
		return instance
	}

	public async set(key: string, value: string): Promise<void> {
		const redisShard: RedisShard = this.redisShardingAlgorithm?.getShard(key)

		const client = this.getClient(redisShard.url)
		if (client) {
			await client.set(key, value)
		} else {
			throw new Error('Redis client not found for URL: ' + redisShard.url)
		}
	}

	public getClient(url: string): RedisClientType | undefined {
		return this.clients.get(url)
	}

	public async get(key: string): Promise<string | null | undefined> {
		const redisShard: RedisShard = this.redisShardingAlgorithm?.getShard(key)
		return this.clients.get(redisShard.url)?.get(key)
	}

	public async getAll(key: string): Promise<string[]> {
		const redisShard: RedisShard = this.redisShardingAlgorithm?.getShard(key)

		return this.clients.get(redisShard.url)?.keys('*') || []
	}

	public async update(key: string, keys: Array<string>, tileServerShard: TileServerShard): Promise<void> {
		const redisShard: RedisShard = this.redisShardingAlgorithm?.getShard(key)
		const client = this.getClient(redisShard.url)

		if (!client) {
			throw new Error('Redis client not found for URL: ' + redisShard.url)
		}

		const existingKeys = await client.keys('*') // Fetches all keys in the shard

		// Adding new keys that are not present in Redis
		for (const key of keys) {
			if (!existingKeys.includes(key)) {
				const lastAccessTimestamp = new Date().toISOString() // Get current time in ISO 8601 format
				const sessionData = new SessionData(key, lastAccessTimestamp, tileServerShard)
				const serializedData = JSON.stringify(sessionData)
				await client.set(key, serializedData)
			}
		}

		// Deleting keys that should no longer be present
		for (const existingKey of existingKeys) {
			if (!keys.includes(existingKey)) {
				await client.del(existingKey)
			}
		}
	}

	public async delete(key: string): Promise<number | undefined> {
		const redisShard: RedisShard = this.redisShardingAlgorithm?.getShard(key)
		return this.clients.get(redisShard.url)?.del(key)
	}

	public async exists(key: string): Promise<boolean> {
		const redisShard: RedisShard = this.redisShardingAlgorithm?.getShard(key)
		const result = await this.clients.get(redisShard.url)?.exists(key)
		return result === 1
	}
}
