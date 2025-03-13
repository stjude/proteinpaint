import ky from 'ky'
import RedisClientHolder from '../redis/RedisClientHolder.ts'
import { TileServerShard } from '#src/shardig/TileServerShard.js'
import { ShardManager } from '#src/shardig/ShardManager.js'
import { TileServerShardingAlgorithm } from '#src/shardig/TileServerShardingAlgorithm.js'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.js'

export class SessionData {
	public imageSessionId: string
	public lastAccessTimestamp: string
	public tileServerShard: TileServerShard

	public constructor(imageSessionId: string, lastAccessTimestamp: string, tileServerShard: TileServerShard) {
		this.imageSessionId = imageSessionId
		this.lastAccessTimestamp = lastAccessTimestamp
		this.tileServerShard = tileServerShard
	}
}

export default class SessionManager {
	private static instance: SessionManager
	private redisClients: RedisClientHolder
	private tileShardingAlgorithm: ShardingAlgorithm<any | undefined> | undefined

	private constructor() {
		this.redisClients = RedisClientHolder.getInstance()

		const shardManager = ShardManager.getInstance()

		this.tileShardingAlgorithm = shardManager.shardingAlgorithmsMap?.get(
			TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY
		)
	}

	public static getInstance(): SessionManager {
		if (!SessionManager.instance) {
			SessionManager.instance = new SessionManager()
		}

		return SessionManager.instance
	}

	public getTileServerShard(key: string): TileServerShard {
		return this.tileShardingAlgorithm?.getShard(key)
	}

	public async setSession(key: string, imageSessionId: string, tileServerShard: TileServerShard): Promise<void> {
		const lastAccessTimestamp = new Date().toISOString() // Get current time in ISO 8601 format
		const sessionData = new SessionData(imageSessionId, lastAccessTimestamp, tileServerShard)
		const serializedData = JSON.stringify(sessionData)
		await this.redisClients.set(key, serializedData)
	}

	public async getSession(key: string): Promise<SessionData | undefined> {
		const tileServer = this.getTileServerShard(key)
		if (!tileServer) {
			return undefined
		}
		const sessions = await this.fetchSessions(tileServer.url)

		// Parse session identifiers from the fetched JSON
		const keys = Object.values<string>(sessions).map(path => {
			const parts = path.split('/')
			return parts[parts.length - 1] // Gets the last segment of the path
		})

		await this.redisClients.update(key, keys, tileServer)

		const sessionData = await this.redisClients.get(key)
		if (!sessionData) {
			return undefined
		}
		return JSON.parse(sessionData) as SessionData
	}

	public async deleteSession(key: string): Promise<void> {
		await this.redisClients.delete(key)
	}

	//  maxIdleTime - time in minutes
	public async invalidateSessions(
		key: string,
		maxSessions: number,
		maxIdleTime: number
	): Promise<{
		success: boolean
		deletedKeys: (SessionData | undefined)[]
	}> {
		const keys = await this.redisClients.getAll(key)

		const keySessions: { key: string; sessionData: SessionData | undefined }[] = await Promise.all(
			keys?.map(async key => ({
				key,
				sessionData: await this.getSession(key)
			}))
		)

		// Early exit if the current number of sessions is below 50% of maxSessions
		if (keySessions.length <= maxSessions * 0.5) {
			return { success: true, deletedKeys: [] }
		}

		// Get current time for comparison
		const now = new Date().getTime()

		// Filter out sessions that have not been accessed within the 'maxIdleTime' minutes
		const idleSessions = keySessions.filter(({ sessionData }) => {
			if (sessionData) {
				const lastAccessed = new Date(sessionData.lastAccessTimestamp).getTime()
				return now - lastAccessed > maxIdleTime * 60000
			}
			return false
		})

		// Check if total keys length is greater than maxSessions and if idle sessions count is smaller than the difference
		if (keys.length > maxSessions && idleSessions.length < keys.length - maxSessions) {
			return { success: false, deletedKeys: [] }
		}

		// Check if the count of idle sessions exceeds 50% of maxSessions
		if (idleSessions.length > maxSessions * 0.5) {
			const excessIdleCount = idleSessions.length - Math.ceil(maxSessions * 0.5)
			// Sort idle sessions by last accessed time to identify the least recently used
			idleSessions.sort((a, b) => {
				const timeA = new Date(a.sessionData?.lastAccessTimestamp ?? 0).getTime()
				const timeB = new Date(b.sessionData?.lastAccessTimestamp ?? 0).getTime()
				return timeA - timeB
			})
			// Identify sessions to delete, focusing on the most idle ones
			const sessionsToDelete = idleSessions.slice(0, excessIdleCount)

			// Perform the deletion of the selected sessions
			await Promise.all(sessionsToDelete.map(({ key }) => this.deleteSession(key)))
			return { success: true, deletedKeys: sessionsToDelete.map(session => session.sessionData) }
		}

		await Promise.all(idleSessions.map(({ key }) => this.deleteSession(key)))

		return { success: true, deletedKeys: idleSessions.map(session => session.sessionData) }
	}

	private async fetchSessions(tileServerUrl: string): Promise<any> {
		try {
			return await ky.get(`${tileServerUrl}/tileserver/sessions`).json()
		} catch (error) {
			console.error('Error fetching sessions:', error)
		}
	}
}
