import type { RouteApi } from '#types'
import type { ClearWSImagesSessionsResponse } from '#types'
import { clearWSImagesSessionsPayload } from '#types/checkers'
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
			// TODO fix this, or remove this endpoint?
			if (serverconfig.redis) {
				const sessionsString = req.query.sessions
				const sessionsArray = JSON.parse(sessionsString)

				// Convert the array into a Map
				const sessions: Map<string, string> = new Map(sessionsArray)
				const sessionManager = SessionManager.getInstance(serverconfig.redis.url)

				for (const [key, value] of sessions.entries()) {
					const sessionData = await sessionManager.getSession(key)
					if (sessionData) {
						await ky.put(`${serverconfig.tileServerURL}/tileserver/reset/${sessionData.imageSessionId}`)
						await sessionManager.deleteSession(key)
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
