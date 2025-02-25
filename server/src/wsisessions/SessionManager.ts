import RedisClientHolder from '../redis/RedisClientHolder.ts'

export class SessionData {
	public imageSessionId: string
	public lastAccessTimestamp: string

	public constructor(imageSessionId: string, lastAccessTimestamp: string) {
		this.imageSessionId = imageSessionId
		this.lastAccessTimestamp = lastAccessTimestamp
	}
}

export default class SessionManager {
	private static instance: SessionManager
	private redisClient: RedisClientHolder

	private constructor(redisUrl: string) {
		this.redisClient = RedisClientHolder.getInstance(redisUrl)
	}

	public static getInstance(redisUrl: string): SessionManager {
		if (!SessionManager.instance) {
			SessionManager.instance = new SessionManager(redisUrl)
		}
		return SessionManager.instance
	}

	public async setSession(key: string, imageSessionId: string): Promise<void> {
		const lastAccessTimestamp = new Date().toISOString() // Get current time in ISO 8601 format
		const sessionData = new SessionData(imageSessionId, lastAccessTimestamp)
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

	// TODO invalidateSessions should tested more
	//  maxIdleTime - time in minutes
	public async invalidateSessions(maxSessions: number, maxIdleTime: number): Promise<void> {
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

		// Check if total number of sessions exceeds the limit 'maxSessions'
		if (keySessions.length >= maxSessions) {
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

			// Combine idle sessions and LRU sessions that need to be deleted
			const allSessionsToDelete = [...new Set([...idleSessions, ...sessionsToDelete])]

			// Delete all sessions that are either idle or are the least recently used beyond the limit
			await Promise.all(allSessionsToDelete.map(({ key }) => this.deleteSession(key)))
		}
	}
}
