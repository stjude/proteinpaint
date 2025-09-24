import ky from 'ky'
import type { RemoteSessionHandler } from '#src/wsisessions/RemoteSessionHandler.ts'
import type { SessionData } from '#src/wsisessions/SessionManager.js'

export class TileServerSessionsHandler implements RemoteSessionHandler {
	async getSessions(url: string): Promise<any | undefined> {
		let sessions: any
		try {
			sessions = await ky.get(`${url}/tileserver/sessions`).json()
		} catch (error) {
			console.warn('Error fetching sessions:', error)
			throw new Error(`Error fetching sessions from ${url}`)
		}

		return sessions
	}

	async resetSessions(keys: Array<SessionData | undefined>): Promise<void> {
		for (const sessionData of keys) {
			try {
				if (sessionData?.tileServerShard) {
					await ky.put(`${sessionData.tileServerShard.url}/tileserver/reset/${sessionData.imageSessionId}`)
				}
			} catch (error) {
				console.info(`Error resetting tile server for sessionId ${sessionData?.imageSessionId}:`, error)
			}
		}
	}
}
