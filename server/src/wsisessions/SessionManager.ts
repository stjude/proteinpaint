import RedisClientHolder from '../redis/RedisClientHolder.ts'

export class SessionData {
	public imageSessionId: string
	public userSessionIds: Array<string>

	public constructor(imageSessionId: string, userSessionIds: string[]) {
		this.imageSessionId = imageSessionId
		this.userSessionIds = userSessionIds
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

	public async setSession(key: string, value: SessionData): Promise<void> {
		const sessionData = JSON.stringify(value)
		await this.redisClient.set(key, sessionData)
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
