import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import type { ShardingAlgorithm } from '#src/sharding/ShardingAlgorithm.ts'
import type { KeyValueStorage } from '#src/caching/KeyValueStorage.ts'
import type { RemoteSessionHandler } from '#src/wsisessions/RemoteSessionHandler.ts'
import RedisClientHolder from '#src/redis/RedisClientHolder.js'
import { ShardManager } from '#src/sharding/ShardManager.js'
import { TileServerShardingAlgorithm } from '#src/sharding/TileServerShardingAlgorithm.js'
import { TileServerSessionsHandler } from '#src/wsisessions/TileServerSessionsHandler.js'
import type { PredictionOverlay } from '#types'

/**
 *  Represents the TileServer session data object.
 *
 *  @see SessionManger for details.
 *
 */
export class SessionData {
	public imageSessionId: string
	public lastAccessTimestamp: string
	public tileServerShard: TileServerShard
	public overlays: Array<PredictionOverlay> | undefined

	public constructor(
		imageSessionId: string,
		lastAccessTimestamp: string,
		tileServerShard: TileServerShard,
		overlays?: Array<PredictionOverlay>
	) {
		this.imageSessionId = imageSessionId
		this.lastAccessTimestamp = lastAccessTimestamp
		this.tileServerShard = tileServerShard
		this.overlays = overlays
	}
}

/**
 * Manages session data for the TileServers.
 *
 * This class is implemented as a singleton to ensure only one instance exists.
 *
 * It provides methods for storing, retrieving, synchronizing, and invalidating session data.
 *
 * The Tiatoolbox TileServer is designed and implemented to be stateful, meaning that it stores sessionId in memory for each displayed image.
 *
 * The session is later used to retrieve the image data from the TileServer.
 *
 * @see the TileServer API https://github.com/TissueImageAnalytics/tiatoolbox/blob/develop/tiatoolbox/visualization/tileserver_api.yml
 *
 * The sequence of endpoints call in order to display the image is as follows:
 * /tileserver/session_id
 * /tileserver/slide
 * /tileserver/layer/{layer}/{session_id}/zoomify/TileGroup{tile_group}/{z}-{x}-{y}@{res}x.jpg:
 *
 * and when the image is not needed anymore:
 * /tileserver/reset/{session_id}
 *
 * The sessionIds are stored in-memory in the TileServer and are used to retrieve the image data from the TileServer.
 *
 * The sessionIds are returned by the /tileserver/session_id endpoint are random.
 *
 * The TileServer don't have any built in mechanism to limit the number of sessionIds,
 * or to be more precise the number images stored in-memory.
 *
 * The SessionManager is used to manage the number of sessionIds stored in-memory in the TileServer.
 * In case the limit is reached, @see syncAndInvalidateSessions method param maxSessions,
 * the SessionManager will try to invalidate the least recently used sessionIds in order to free up memory in the TileServer.
 * In case no sessionIds are found that can be invalidated, the SessionManager.syncAndInvalidateSessions will return false.
 *
 * The session manager stores the session data in a KeyValueStorage, which is an abstraction over Redis instances in this case.
 * The RedisShardingAlgorithm is used to determine the Redis shard based on the image key.
 *
 * The SessionManager uses the TileServerShardingAlgorithm to determine the TileServer shard based on the image key.
 *
 */
export default class SessionManager {
	private static instance: SessionManager | undefined
	private keyValueStorages: KeyValueStorage
	private tileShardingAlgorithm: ShardingAlgorithm<any | undefined> | undefined
	private sessionFetcher: RemoteSessionHandler

	private constructor(
		keyValueStorages: KeyValueStorage,
		shardingAlgorithm: ShardingAlgorithm<any>,
		sessionFetcher: RemoteSessionHandler
	) {
		this.keyValueStorages = keyValueStorages
		this.tileShardingAlgorithm = shardingAlgorithm
		this.sessionFetcher = sessionFetcher
	}

	public static getInstance(
		keyValueStorages: KeyValueStorage = RedisClientHolder.getInstance(),
		shardingAlgorithm: ShardingAlgorithm<any> | undefined = ShardManager.getInstance().shardingAlgorithmsMap.get(
			TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY
		),
		sessionFetcher: RemoteSessionHandler = new TileServerSessionsHandler()
	): SessionManager {
		if (!SessionManager.instance) {
			if (!shardingAlgorithm) {
				throw new Error('Sharding algorithm is not defined')
			}
			SessionManager.instance = new SessionManager(keyValueStorages, shardingAlgorithm, sessionFetcher)
		}
		return SessionManager.instance
	}

	/*
	 * Clear the instance of the SessionManager, should be used just for testing.
	 */
	public static clearInstance(): void {
		SessionManager.instance = undefined
	}

	public getTileServerShard(key: string): Promise<TileServerShard> | undefined {
		return this.tileShardingAlgorithm?.getShard(key)
	}

	public async setSession(
		key: string,
		imageSessionId: string,
		tileServerShard: TileServerShard,
		overlays?: PredictionOverlay[] | undefined,
		lastAccessTimestamp = new Date().toISOString()
	): Promise<SessionData> {
		const sessionData = new SessionData(imageSessionId, lastAccessTimestamp, tileServerShard, overlays ? overlays : [])
		const serializedData = JSON.stringify(sessionData)
		await this.keyValueStorages.set(key, serializedData)

		return sessionData
	}

	public async getSession(key: string): Promise<SessionData | undefined> {
		const sessionData = await this.keyValueStorages.get(key)
		if (!sessionData) {
			return undefined
		}
		return JSON.parse(sessionData) as SessionData
	}

	public async updateSession(key: string): Promise<void> {
		const sessionData = await this.getSession(key)

		if (sessionData) {
			const shard = await this.getTileServerShard(key)
			if (shard?.url === sessionData.tileServerShard.url) {
				const lastAccessTimestamp = new Date().toISOString()
				const updatedSessionData = new SessionData(
					sessionData.imageSessionId,
					lastAccessTimestamp,
					shard,
					sessionData.overlays
				)
				const serializedData = JSON.stringify(updatedSessionData)

				await this.keyValueStorages.set(key, serializedData)
			}
		}
	}

	public async getCount(key: string): Promise<number> {
		const strings = await this.keyValueStorages.getAllKeys(key)
		return strings.length
	}

	public async getAllSessions(key: string = ''): Promise<Array<SessionData | undefined>> {
		// keyValueStorages.getAllKeyValues returns array of { key, sessionData } in other usages
		const keySessions = await this.keyValueStorages.getAllKeyValues(key)
		return keySessions.map((kv: any) => kv.sessionData as SessionData | undefined)
	}

	public async getAllKeyValues(
		key: string = ''
	): Promise<Array<{ key: string; sessionData: SessionData | undefined }>> {
		return this.keyValueStorages.getAllKeyValues(key)
	}

	public async deleteSession(key: string): Promise<void> {
		await this.keyValueStorages.delete(key)
	}

	/**
	 * Synchronizes sessions with the TileServer instance determined by the key param and invalidates idle sessions based on constraints.
	 *
	 * @param key - The unique key for storing the session data. In this case it's a file path of the image.
	 * @param maxSessions - The maximum allowed number of sessions. By default, it's set to 20.
	 * @param maxIdleTime - The maximum idle time (in minutes) before sessions are invalidated. By default, it's set to 120 minutes.
	 * @param invalidationThreshold - The percentage of the sessions that should NOT be invalidated. By default, it's set to 0.5.
	 * If the total number of sessions is equal or surpasses the maxSessions limit,
	 * the system will attempt to invalidate sessions that have not been accessed within the maxIdleTime,
	 * so the total number of sessions stays below the maxSessions limit and above the invalidationThreshold * maxSessions.
	 *
	 * @returns A promise resolving to a boolean indicating whether synchronization and invalidation were successful.
	 *
	 */
	public async syncAndInvalidateSessions(
		key: string,
		maxSessions: number = 20,
		maxIdleTime: number = 120,
		invalidationThreshold: number = 0.5
	): Promise<boolean> {
		const tileServer: TileServerShard | undefined = await this.getTileServerShard(key)

		if (!tileServer) {
			return false
		}

		const sessions = await this.sessionFetcher.getSessions(tileServer.url)

		await this.keyValueStorages.update(key, sessions, tileServer)

		const keySessions = await this.keyValueStorages.getAllKeyValues(key)

		const keys = await this.keyValueStorages.getAllKeys(key)

		if (keys.includes(key)) {
			return true
		}

		if (keySessions.length <= maxSessions * invalidationThreshold) {
			return true
		}

		// Get current time for comparison
		const now = new Date().getTime()

		// Filter out sessions that have not been accessed within the 'maxIdleTime' minutes
		const idleSessions: Array<{ key: string; sessionData: SessionData | undefined }> = keySessions.filter(
			({ sessionData }) => {
				if (sessionData) {
					const lastAccessed = new Date(sessionData.lastAccessTimestamp).getTime()
					return now - lastAccessed > maxIdleTime * 60000
				}
				return false
			}
		)

		// Check if total keys length is greater than maxSessions and if idle sessions count is smaller than the difference
		if (keys.length >= maxSessions && idleSessions.length <= keys.length - maxSessions) {
			return false
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

			const sessionDataToDelete: Array<SessionData | undefined> = sessionsToDelete.map(session => session.sessionData)
			await this.sessionFetcher.resetSessions(sessionDataToDelete)

			return true
		}

		// TODO fix this
		await Promise.all(idleSessions.map(({ key }) => this.deleteSession(key)))
		const deletedKeys: Array<SessionData | undefined> = idleSessions.map(session => session.sessionData)
		await this.sessionFetcher.resetSessions(deletedKeys)

		return true
	}
}
