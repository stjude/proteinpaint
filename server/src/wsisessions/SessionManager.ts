import ky from 'ky'
import { TileServerShard } from '#src/shardig/TileServerShard.ts'
import { ShardingAlgorithm } from '#src/shardig/ShardingAlgorithm.ts'
import { KeyValueStorage } from '#src/caching/KeyValueStorage.ts'

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
	private static instance: SessionManager | undefined
	private keyValueStorages: KeyValueStorage
	private tileShardingAlgorithm: ShardingAlgorithm<any | undefined> | undefined

	private constructor(keyValueStorages: KeyValueStorage, shardingAlgorithm: ShardingAlgorithm<any>) {
		this.keyValueStorages = keyValueStorages
		this.tileShardingAlgorithm = shardingAlgorithm
	}

	public static getInstance(
		keyValueStorages: KeyValueStorage,
		shardingAlgorithm: ShardingAlgorithm<any>
	): SessionManager {
		if (!SessionManager.instance) {
			SessionManager.instance = new SessionManager(keyValueStorages, shardingAlgorithm)
		}
		return SessionManager.instance
	}

	public getTileServerShard(key: string): Promise<any> | undefined {
		return this.tileShardingAlgorithm?.getShard(key)
	}

	public async setSession(key: string, imageSessionId: string, tileServerShard: TileServerShard): Promise<void> {
		const lastAccessTimestamp = new Date().toISOString() // Get current time in ISO 8601 format
		const sessionData = new SessionData(imageSessionId, lastAccessTimestamp, tileServerShard)
		const serializedData = JSON.stringify(sessionData)
		await this.keyValueStorages.set(key, serializedData)
	}

	public async getSession(key: string): Promise<SessionData | undefined> {
		const tileServer = await this.getTileServerShard(key)
		if (!tileServer) {
			return undefined
		}

		let sessions = []
		try {
			sessions = await ky.get(`${tileServer.url}/tileserver/sessions`).json()
		} catch (error) {
			console.warn('Error fetching sessions:', error)
			throw new Error('Error fetching sessions from ${tileServer.url}')
		}

		await this.keyValueStorages.update(key, sessions, tileServer)

		const sessionData = await this.keyValueStorages.get(key)
		if (!sessionData) {
			return undefined
		}
		return JSON.parse(sessionData) as SessionData
	}

	public async deleteSession(key: string): Promise<void> {
		await this.keyValueStorages.delete(key)
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
		const keys = await this.keyValueStorages.getAll(key)

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
			await Promise.all(
				sessionsToDelete.map(({ key }) => {
					this.deleteSession(key)
				})
			)
			return { success: true, deletedKeys: sessionsToDelete.map(session => session.sessionData) }
		}

		// TODO fix this
		await Promise.all(idleSessions.map(({ key }) => this.deleteSession(key)))

		return { success: true, deletedKeys: idleSessions.map(session => session.sessionData) }
	}
}
