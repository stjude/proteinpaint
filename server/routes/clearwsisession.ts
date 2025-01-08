import type { RouteApi } from '#types'
import { clearWSImagesSessionsPayload } from '@sjcrh/proteinpaint-types/routes/clearwsisessions.js'
import type { ClearWSImagesSessionsResponse } from '@sjcrh/proteinpaint-types/routes/clearwsisessions.js'
import SessionManager from '#src/wsisessions/SessionManager.js'
import ky from 'ky'
import serverconfig from '#src/serverconfig.js'

/*
Delete sessions from the wsi session manager
*/

export const api: RouteApi = {
	endpoint: 'clearwsisession',
	methods: {
		delete: {
			...clearWSImagesSessionsPayload,
			init
		}
	}
}

function init() {
	return async (req: any, res: any): Promise<void> => {
		try {
			if (serverconfig.redis) {
				const sessionsString = req.query.sessions
				const sessionsArray = JSON.parse(sessionsString)

				// Convert the array into a Map
				const sessions: Map<string, string> = new Map(sessionsArray)
				const sessionManager = SessionManager.getInstance(serverconfig.redis.url)

				for (const [key, value] of sessions.entries()) {
					const sessionData = await sessionManager.getSession(key)
					if (sessionData) {
						const userSessionIds = sessionData.userSessionIds
						// Validate that at least one of the `userSessionIds` is equal to `value`
						if (!userSessionIds.some((sessionId: string) => sessionId === value)) {
							break
						}

						// Filter out the `value` from the `userSessionIds`
						const newSessions = userSessionIds.filter((sessionId: string) => sessionId !== value)
						if (newSessions.length === 0) {
							await ky.put(`${serverconfig.tileServerURL}/tileserver/reset/${sessionData.imageSessionId}`)
							await sessionManager.deleteSession(key)
						} else {
							// Update the sessionData with the filtered sessions
							sessionData.userSessionIds = newSessions

							// Persist the updated session data
							await sessionManager.setSession(key, sessionData)
						}
					}
				}

				res.send({ message: 'Sessions cleared' } satisfies ClearWSImagesSessionsResponse)
			} else {
				res.status(404).send('Redis not configured')
			}
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Error clearing sessions')
		}
	}
}
