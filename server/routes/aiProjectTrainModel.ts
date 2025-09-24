import type { RouteApi, AIProjectTrainModelRequest } from '#types'
import { aiProjectTrainModelPayload } from '#types/checkers'
import { TileServerSessionsHandler } from '#src/wsisessions/TileServerSessionsHandler.ts'
import SessionManager from '#src/wsisessions/SessionManager.ts'

export const api: RouteApi = {
	endpoint: 'aiProjectTrainModel',
	methods: {
		get: {
			...aiProjectTrainModelPayload,
			init
		},
		post: {
			...aiProjectTrainModelPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async function (req, res) {
		try {
			const query: AIProjectTrainModelRequest = req.query
			console.log(query)
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'

			if (typeof ds.queries.WSImages.retrainModel == 'function') {
				await ds.queries.WSImages.retrainModel(query.projectId)

				// After retraining, read sessions from SessionManager and reset them via TileServerSessionsHandler.
				try {
					const handler = new TileServerSessionsHandler()
					const sessionMgr = SessionManager.getInstance()

					// optionally pass a keyPrefix if you want to limit which sessions to read
					const sessions = await sessionMgr.getAllSessions()
					if (sessions && sessions.length) {
						await handler.resetSessions(sessions)
					}
				} catch (err) {
					console.warn('TileServerSessionsHandler error:', err)
				}
			} else {
				res.status(500).send({
					status: 'error',
					error: 'No retraining script defined'
				})
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
