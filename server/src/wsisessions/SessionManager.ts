import { createClient } from 'redis'

export class SessionData {
	public imageSessionId: string
	public userSessionIds: Array<string>

	public constructor(imageSessionId: string, userSessionIds: string[]) {
		this.imageSessionId = imageSessionId
		this.userSessionIds = userSessionIds
	}
}

export class SessionContent {
	public lastAccessed: Date
	public data: SessionData
	public ttl: number // Time to live in milliseconds

	constructor(data: SessionData, ttl: number) {
		this.data = data
		this.ttl = ttl
		this.lastAccessed = new Date()
	}

	public isExpired(): boolean {
		const now = new Date()
		return now.getTime() - this.lastAccessed.getTime() > this.ttl
	}

	public refreshLastAccessed(): void {
		this.lastAccessed = new Date()
	}
}

export default class SessionManager {
	private static instance: SessionManager
	private redisClient: any

	private constructor(redisUrl = 'redis://localhost:6379') {
		this.redisClient = createClient({ url: redisUrl })

		this.redisClient.on('error', (err: any) => {
			console.error('Redis Client Error', err)
		})

		this.redisClient.connect()
	}

	public static getInstance(redisUrl = 'redis://localhost:6379'): SessionManager {
		if (!SessionManager.instance) {
			SessionManager.instance = new SessionManager(redisUrl)
		}
		return SessionManager.instance
	}

	public async setSession(key: string, value: SessionData, ttl: number = 1000 * 60 * 60 * 24): Promise<void> {
		const session = new SessionContent(value, ttl)
		const sessionData = JSON.stringify({
			data: session.data,
			lastAccessed: session.lastAccessed.toISOString(),
			ttl: session.ttl
		})

		// Set the session in Redis with TTL (in milliseconds)
		await this.redisClient.set(key, sessionData, {
			PX: ttl
		})
	}

	public async getSession(key: string): Promise<SessionData | undefined> {
		const sessionData = await this.redisClient.get(key)
		if (!sessionData) {
			return undefined
		}

		const parsedData = JSON.parse(sessionData)
		const session = new SessionContent(parsedData.data, parsedData.ttl)
		session.lastAccessed = new Date(parsedData.lastAccessed)

		if (session.isExpired()) {
			await this.redisClient.del(key)
			return undefined
		}

		session.refreshLastAccessed()
		await this.setSession(key, session.data, session.ttl) // Refresh session TTL
		return session.data as SessionData
	}

	public async deleteSession(key: string): Promise<void> {
		await this.redisClient.del(key)
	}

	public async close(): Promise<void> {
		await this.redisClient.quit()
	}
}
