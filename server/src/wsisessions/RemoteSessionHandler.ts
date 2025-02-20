import { SessionData } from '#src/wsisessions/SessionManager.ts'

export interface RemoteSessionHandler {
	getSessions(key: string): Promise<any | undefined>

	resetSessions(keys: Array<SessionData | undefined>): Promise<void>
}
