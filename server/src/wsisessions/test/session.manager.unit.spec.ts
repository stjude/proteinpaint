import tape from 'tape'
import SessionManager from '#src/wsisessions/SessionManager.ts'
import { KeyValueStoragesMock } from '#src/wsisessions/test/KeyValueStoragesMock.ts'
import { TileServerShardingAlgorithmMock } from '#src/wsisessions/test/TileServerShardingAlgorithmMock.ts'

tape('Session manager test', test => {
	test.timeoutAfter(1000)

	const sessionManager = SessionManager.getInstance(new KeyValueStoragesMock(), new TileServerShardingAlgorithmMock())

	// TODO add tests.

	test.end()
})
