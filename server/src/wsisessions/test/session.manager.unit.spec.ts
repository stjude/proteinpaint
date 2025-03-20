import tape from 'tape'
import SessionManager, { SessionData } from '#src/wsisessions/SessionManager.ts'
import { KeyValueStoragesMock } from '#src/wsisessions/test/KeyValueStoragesMock.ts'
import { TileServerShardingAlgorithmMock } from '#src/wsisessions/test/TileServerShardingAlgorithmMock.ts'
import { RemoteSessionsFetcherMock } from '#src/wsisessions/test/RemoteSessionsFetcherMock.ts'
import { TileServerShard } from '#src/sharding/TileServerShard.js'

tape(
	'SessionManager.invalidateSessions returns true when no sessions in KeyValueStorage and in TileServer',
	async test => {
		test.timeoutAfter(1000)

		SessionManager.clearInstance()
		const sessionManager = SessionManager.getInstance(
			new KeyValueStoragesMock(),
			new TileServerShardingAlgorithmMock(),
			new RemoteSessionsFetcherMock({})
		)

		const result = await sessionManager.syncAndInvalidateSessions('key1', 1, 1)

		const sessionsCount = await sessionManager.getCount('key2')

		test.equal(sessionsCount, 0, 'There should be 0 sessions')

		test.equal(result, true, 'should return true')

		test.end()
	}
)

tape(
	'SessionManager.invalidateSessions returns false when 1 session in KeyValueStorage and in TileServer and maxSessions is 1',
	async test => {
		test.timeoutAfter(1000)

		SessionManager.clearInstance()
		const sessionManager = SessionManager.getInstance(
			new KeyValueStoragesMock(),
			new TileServerShardingAlgorithmMock(),
			new RemoteSessionsFetcherMock({
				imageSessionId1: 'key1'
			})
		)

		await sessionManager.setSession('key1', 'imageSessionId1', new TileServerShard('url'))

		const result = await sessionManager.syncAndInvalidateSessions('key2', 1, 1)

		const sessionsCount = await sessionManager.getCount('key2')

		test.equal(sessionsCount, 1, 'There should be 1 sessions')

		test.equal(result, false, 'should return false')

		test.end()
	}
)

tape(
	'SessionManager.invalidateSessions returns false when 2 session in KeyValueStorage and in TileServer and maxSessions is 1',
	async test => {
		test.timeoutAfter(1000)

		SessionManager.clearInstance()
		const sessionManager = SessionManager.getInstance(
			new KeyValueStoragesMock(),
			new TileServerShardingAlgorithmMock(),
			new RemoteSessionsFetcherMock({
				imageSessionId1: 'key1',
				imageSessionId2: 'key2'
			})
		)

		await sessionManager.setSession('key1', 'imageSessionId1', new TileServerShard('url'))
		await sessionManager.setSession('key2', 'imageSessionId2', new TileServerShard('url'))

		const result = await sessionManager.syncAndInvalidateSessions('key3', 1, 1)

		const sessionsCount = await sessionManager.getCount('key3')

		test.equal(sessionsCount, 2, 'There should be 2 sessions')

		test.equal(result, false, 'should return false')

		test.end()
	}
)

tape(
	'SessionManager.invalidateSessions returns false when 2 session in KeyValueStorage and in TileServer and maxSessions is 2',
	async test => {
		test.timeoutAfter(1000)

		SessionManager.clearInstance()
		const sessionManager = SessionManager.getInstance(
			new KeyValueStoragesMock(),
			new TileServerShardingAlgorithmMock(),
			new RemoteSessionsFetcherMock({
				imageSessionId1: 'key1',
				imageSessionId2: 'key2'
			})
		)

		await sessionManager.setSession('key1', 'imageSessionId1', new TileServerShard('url'))
		await sessionManager.setSession('key2', 'imageSessionId2', new TileServerShard('url'))

		const result = await sessionManager.syncAndInvalidateSessions('key3', 2, 1)

		const sessionsCount = await sessionManager.getCount('key3')

		test.equal(sessionsCount, 2, 'There should be 2 sessions')

		test.equal(result, false, 'should return false')

		test.end()
	}
)

tape(
	'SessionManager.invalidateSessions returns true when 2 session in KeyValueStorage and in TileServe and one of them is expired and maxSessions is 2',
	async test => {
		test.timeoutAfter(1000)

		const keyValueStorages: Map<string, string> = new Map<string, string>()

		const fiveMinutesAgo = new Date(new Date().getTime() - 5 * 60000).toISOString()

		const tileServerShard = new TileServerShard('url')

		const sessionData1 = new SessionData('imageSessionId1', fiveMinutesAgo, tileServerShard)
		const serializedData1 = JSON.stringify(sessionData1)

		const sessionData2 = new SessionData('imageSessionId2', fiveMinutesAgo, tileServerShard)
		const serializedData2 = JSON.stringify(sessionData2)

		keyValueStorages.set('key1', serializedData1)
		keyValueStorages.set('key2', serializedData2)

		const keyValueStoragesMock = new KeyValueStoragesMock(keyValueStorages)

		SessionManager.clearInstance()
		const sessionManager = SessionManager.getInstance(
			keyValueStoragesMock,
			new TileServerShardingAlgorithmMock(),
			new RemoteSessionsFetcherMock({
				imageSessionId1: 'key1',
				imageSessionId2: 'key2'
			})
		)

		const result = await sessionManager.syncAndInvalidateSessions('key3', 2, 1)

		const sessionsCount = await sessionManager.getCount('key3')

		test.equal(sessionsCount, 1, 'There should be 1 sessions')

		test.equal(result, true, 'should return true')

		test.end()
	}
)
