import type { RoutePayload } from '#types'
import type { RouteApi, AIProjectTrainModelRequest } from '#types'
import { TileServerSessionsHandler } from '#src/wsisessions/TileServerSessionsHandler.ts'
import SessionManager from '#src/wsisessions/SessionManager.ts'
import { getDbConnection } from '#src/aiHistoDBConnection.js'
import type Database from 'better-sqlite3'
import { getImages } from '../../routes/aiProjectAdmin.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'AIProjectTrainModelRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'AIProjectTrainModelResponse' }
}

export const api: RouteApi = {
	endpoint: 'aiProjectTrainModel',
	methods: {
		// This endpoint does not support write operation, the same readonly request/response
		// payload init/typeId/checker is expected for both GET and POST methods, where POST
		// is used when the request payload is to large to be encoded as URL parameters.
		// May switch to using HTTP QUERY method once that is stable and widely supported.
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async function (req, res) {
		try {
			const query: AIProjectTrainModelRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'

			if (typeof ds.queries.WSImages.retrainModel == 'function') {
				const connection = getDbConnection(ds) as Database.Database

				const project = {
					id: query.projectId
				}

				const wsimages = getImages(connection, project)

				await ds.queries.WSImages.retrainModel(query.projectId, wsimages)

				// After retraining, read sessions from SessionManager and reset them via TileServerSessionsHandler.
				try {
					const handler = new TileServerSessionsHandler()
					const sessionMgr = SessionManager.getInstance()

					// Get key/value pairs so we can both reset remote sessions and delete them locally
					const keySessions = await sessionMgr.getAllKeyValues()
					const sessions = keySessions.map((kv: any) => kv?.sessionData).filter(Boolean)

					if (sessions && sessions.length) {
						await handler.resetSessions(sessions)
						// delete all sessions from session manager
						await Promise.all(keySessions.map((kv: any) => sessionMgr.deleteSession(kv.key)))
					}
				} catch (err) {
					console.warn('TileServerSessionsHandler error:', err)
				}
			} else {
				res.status(500).send({
					status: 'error',
					error: 'No retraining script defined'
				})
				return
			}

			res.status(200).send({
				status: 'ok',
				message: `Retraining model completed`
			})
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}
