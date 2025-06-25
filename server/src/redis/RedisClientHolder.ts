import type { RedisClientType } from 'redis'
import { createClient } from 'redis'
import serverconfig from '#src/serverconfig.js'
import type { RedisShard } from '#src/sharding/RedisShard.ts'
import { ShardManager } from '#src/sharding/ShardManager.ts'
import { RedisShardingAlgorithm } from '#src/sharding/RedisShardingAlgorithm.ts'
import type { ShardingAlgorithm } from '#src/sharding/ShardingAlgorithm.ts'
import { SessionData } from '#src/wsisessions/SessionManager.ts'
import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import { ClientHolder } from '#src/caching/ClientHolder.ts'
import type { KeyValueStorage } from '#src/caching/KeyValueStorage.ts'
import type { PredictionOverlay } from '#types'
import { PredictionOverlayType } from '#types'

export default class RedisClientHolder implements KeyValueStorage {
	private static instance: RedisClientHolder
	private clients: Map<string, RedisClientType> = new Map()
	private errorLogTimers: Map<string, NodeJS.Timeout> = new Map()

	private shardManager
	private redisShardingAlgorithm: ShardingAlgorithm<any> | undefined

	private constructor() {
		const redisNodes = serverconfig.features?.redis?.nodes || []

		for (const redisNode of redisNodes) {
			const redisUrl = redisNode.url

			const client: RedisClientType = createClient({
				url: redisUrl
			})

			client.on('error', (err: any) => {
				if (!this.errorLogTimers.get(redisUrl)) {
					console.warn('Redis Client Error at', redisUrl, ':', err)
					// Set a timer that prevents further logs for 30 seconds
					const timer = setTimeout(() => {
						this.errorLogTimers.delete(redisUrl)
					}, 30000) // 30 seconds
					this.errorLogTimers.set(redisUrl, timer)
				}
			})

			client.on('connect', () => {
				console.info('Redis client connected at', redisUrl)
			})

			client.on('ready', () => {
				console.info('Redis client ready at', redisUrl)
			})

			client.connect()
			this.clients.set(redisNode.url, client)
		}

		this.shardManager = ShardManager.getInstance()
		this.redisShardingAlgorithm = this.shardManager.shardingAlgorithmsMap.get(RedisShardingAlgorithm.REDIS_SHARDING_KEY)
	}

	async getAllKeyValues(key: string): Promise<{ key: string; sessionData: SessionData | undefined }[]> {
		const keys = await this.getAllKeys(key)
		const results: { key: string; sessionData: SessionData | undefined }[] = []

		for (const key of keys) {
			const value = await this.get(key)
			let sessionData: SessionData | undefined = undefined

			if (value) {
				try {
					sessionData = JSON.parse(value) as SessionData
				} catch (e) {
					console.error(`Error parsing JSON for key: ${key}`, e)
				}
			}

			results.push({ key, sessionData })
		}

		return results
	}

	public static getInstance(): KeyValueStorage {
		if (!RedisClientHolder.instance) {
			RedisClientHolder.instance = new RedisClientHolder()
		}
		return RedisClientHolder.instance
	}

	public async isNodeOnline(url: string, timeout = 2000): Promise<boolean> {
		// Default timeout of 2 seconds
		console.info('Checking if Redis node is online at', url)
		const client = this.clients.get(url)
		if (!client) {
			console.error('No client found for URL:', url)
			return false
		}

		try {
			await Promise.race([
				client.ping(),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
			])
			console.info('Redis node is online:', url)
			return true
		} catch (error) {
			console.error('Error pinging Redis at', url, ':', error)
			return false
		}
	}

	public async set(key: string, value: string): Promise<void> {
		const redisShard: RedisShard = await this.redisShardingAlgorithm?.getShard(key)

		const client: RedisClientType = this.getClient(redisShard.url)?.client
		if (client) {
			await client.set(key, value)
		} else {
			throw new Error('Redis client not found for URL: ' + redisShard.url)
		}
	}

	public getClient(url: string): ClientHolder<any> {
		return new ClientHolder(this.clients.get(url))
	}

	public async get(key: string): Promise<string | null | undefined> {
		const redisShard: RedisShard = await this.redisShardingAlgorithm?.getShard(key)
		return this.clients.get(redisShard.url)?.get(key)
	}

	public async getAllKeys(key: string): Promise<string[]> {
		const redisShard: RedisShard = await this.redisShardingAlgorithm?.getShard(key)

		return this.clients.get(redisShard.url)?.keys('*') || []
	}

	public async update(
		key: string,
		sessions: Record<string, { [layerName: string]: string }>,
		tileServerShard: TileServerShard
	): Promise<void> {
		const redisShard: RedisShard = await this.redisShardingAlgorithm?.getShard(key)
		const client = this.getClient(redisShard.url)?.client

		if (!client) {
			throw new Error('Redis client not found for URL: ' + redisShard.url)
		}

		const existingKeys = await client.keys('*') // Current Redis keys (e.g. slide paths)
		const existingKeysSet = new Set(existingKeys)

		// Helper to infer PredictionOverlayType from filename
		const guessOverlayType = (filename: string): PredictionOverlayType =>
			/uncertainty/i.test(filename) ? PredictionOverlayType.UNCERTAINTY : PredictionOverlayType.PREDICTION

		// Extract slide paths from incoming sessions
		const slidePaths = Object.values(sessions)
			.map(obj => obj?.slide)
			.filter(Boolean) // remove undefined/null

		// Remove stale Redis keys
		for (const redisKey of existingKeys) {
			if (!slidePaths.includes(redisKey)) {
				await client.del(redisKey)
			}
		}

		// Find new slide paths that need to be inserted
		const result: Array<[string, string, PredictionOverlay[]]> = []

		for (const [sessionId, layersObj] of Object.entries(sessions)) {
			const slidePath = layersObj.slide
			if (!slidePath || existingKeysSet.has(slidePath)) continue

			const overlays: PredictionOverlay[] = Object.entries(layersObj)
				.filter(([layer]) => layer !== 'slide')
				.map(([layerNumber, filePath]) => ({
					layerNumber,
					predictionOverlayType: guessOverlayType(path.basename(filePath))
				}))

			result.push([sessionId, slidePath, overlays])
		}

		// Store each new session by slide path
		for (const [sessionId, slidePath, overlays] of result) {
			const lastAccessTimestamp = new Date().toISOString()

			// If no overlay layers were detected, pass `undefined` so the field
			// is omitted from the JSON that gets stored in Redis.
			const sessionData =
				overlays && overlays.length
					? new SessionData(sessionId, lastAccessTimestamp, tileServerShard, overlays)
					: new SessionData(sessionId, lastAccessTimestamp, tileServerShard /* overlays = undefined */)

			await client.set(slidePath, JSON.stringify(sessionData))
		}
	}

	public async delete(key: string): Promise<number | undefined> {
		const redisShard: RedisShard = await this.redisShardingAlgorithm?.getShard(key)
		return this.clients.get(redisShard.url)?.del(key)
	}

	public async exists(key: string): Promise<boolean> {
		const redisShard: RedisShard = await this.redisShardingAlgorithm?.getShard(key)
		const result = await this.clients.get(redisShard.url)?.exists(key)
		return result === 1
	}
}
