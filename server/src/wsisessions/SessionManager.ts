import RedisClientHolder from '../redis/RedisClientHolder.ts'
import { RedisShard } from '#src/shardig/RedisShard.js'
import { TileServerShard } from '#src/shardig/TileServerShard.js'

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
	private redisClient: RedisClientHolder

	private constructor(redisShard: RedisShard) {
		this.redisClient = RedisClientHolder.getInstance(redisShard.url, redisShard.secret)
	}

	public static getInstance(redis: RedisShard): SessionManager {
		if (!SessionManager.instance) {
			SessionManager.instance = new SessionManager(redis)
		}
		return SessionManager.instance
	}

	public async setSession(key: string, imageSessionId: string, tileServerShard: TileServerShard): Promise<void> {
		const lastAccessTimestamp = new Date().toISOString() // Get current time in ISO 8601 format
		const sessionData = new SessionData(imageSessionId, lastAccessTimestamp, tileServerShard)
		const serializedData = JSON.stringify(sessionData)
		await this.redisClient.set(key, serializedData)
	}

	public async getSession(key: string): Promise<SessionData | undefined> {
		const sessionData = await this.redisClient.get(key)
		if (!sessionData) {
			return undefined
		}
		return JSON.parse(sessionData) as SessionData
	}

	public async deleteSession(key: string): Promise<void> {
		await this.redisClient.delete(key)
	}

	// TODO don't delete all sessions, only the ones that are 50% of the limit
	//  maxIdleTime - time in minutes
	public async invalidateSessions(
		maxSessions: number,
		maxIdleTime: number
	): Promise<{
		success: boolean
		deletedKeys: (SessionData | undefined)[]
	}> {
		const keys = await this.redisClient.getAll()
		const keySessions: { key: string; sessionData: SessionData | undefined }[] = await Promise.all(
			keys.map(async key => ({
				key,
				sessionData: await this.getSession(key)
			}))
		)

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

		// Initial sessions to delete includes idle sessions
		let allSessionsToDelete = [...idleSessions]

		// Check if total number of sessions exceeds the limit 'maxSessions'
		if (keySessions.length > maxSessions) {
			// Sort sessions by their last access time to identify the least recently used
			const sortedByLRU = keySessions.sort((a, b) => {
				if (a.sessionData && b.sessionData) {
					return (
						new Date(a.sessionData.lastAccessTimestamp).getTime() -
						new Date(b.sessionData.lastAccessTimestamp).getTime()
					)
				}
				return 0
			})

			// Determine which sessions to delete based on being beyond the 'maxSessions' limit
			const sessionsToDelete = sortedByLRU.slice(0, sortedByLRU.length - maxSessions)
			allSessionsToDelete = [...new Set([...allSessionsToDelete, ...sessionsToDelete])]
		}

		// Delete all sessions that are either idle or are the least recently used beyond the limit
		const deletedKeys = allSessionsToDelete.map(session => session.sessionData)

		if (keys.length >= maxSessions && allSessionsToDelete.length === 0) {
			return { success: false, deletedKeys: [] }
		} else {
			await Promise.all(allSessionsToDelete.map(({ key }) => this.deleteSession(key)))
			return { success: true, deletedKeys }
		}
	}
}
