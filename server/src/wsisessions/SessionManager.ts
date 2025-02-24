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
}
