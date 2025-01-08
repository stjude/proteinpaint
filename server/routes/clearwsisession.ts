import type { RouteApi } from '#types'
import {
	clearWSImagesSessionsPayload,
	ClearWSImagesSessionsResponse
} from '@sjcrh/proteinpaint-types/routes/clearwsisessions.js'
import SessionManager from '#src/wsisessions/SessionManager.js'
import ky from 'ky'
import serverconfig from '#src/serverconfig.js'

/*
given a sample, return all whole slide images for specified dataset
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

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			// const g = genomes[query.genome]
			// if (!g) throw 'invalid genome name'
			// const ds = g.datasets[query.dslabel]
			// if (!ds) throw 'invalid dataset name'

			const sessionsString = req.query.sessions // Get the sessions string
			const sessionsArray = JSON.parse(sessionsString) // Parse the JSON string into an array

			// Convert the array into a Map
			const sessions: Map<string, string> = new Map(sessionsArray)
			const sessionManager = SessionManager.getInstance()

			for (const [key, value] of sessions.entries()) {
				const sessionData = await sessionManager.getSession(key)
				if (sessionData) {
					const userSessionIds = sessionData.userSessionIds
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
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Error clearing sessions')
		}
	}
}
