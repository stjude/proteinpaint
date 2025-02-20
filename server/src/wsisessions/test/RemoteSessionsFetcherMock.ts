import type { RemoteSessionHandler } from '#src/wsisessions/RemoteSessionHandler.ts'
import type { SessionData } from '#src/wsisessions/SessionManager.ts'

/*
 * This class is a mock class for the RemoteSessionHandler interface.
 *
 * It's used just for unit tests.
 */
export class RemoteSessionsFetcherMock implements RemoteSessionHandler {
	constructor(private readonly json: any) {}

	async resetSessions(_keys: Array<SessionData | undefined>): Promise<void> {}

	async getSessions(_key: string): Promise<any | undefined> {
		return this.json
	}
}
