import fs from 'fs'
import type { RouteApi } from '#types'
import { authApi } from '#src/auth.js'
import { getSessionPath } from './massSession.ts'

export const api: RouteApi = {
	// lists the mass session ids that were saved under the requester's credentials
	endpoint: 'sessionIds',
	methods: {
		get: {
			init: () => getSessionIdsByCred,
			request: { typeId: 'SessionIdsRequest' /*, checkers: TODO write validator */ },
			response: { typeId: 'SessionIdsResponse' }
		}
	}
}

async function getSessionIdsByCred(req, res) {
	try {
		const { route, dslabel, embedder } = req.query
		const payload = authApi.getPayloadFromHeaderAuth(req, route)
		if (!payload.email) {
			throw `invalid credentials: no jwt.email`
		}
		if (payload.dslabel != dslabel || payload.route != route || payload.embedder != embedder) {
			throw `invalid credentials: mismatched payload`
		}
		const dir = getSessionPath(req.query, payload)
		const dirExists = await fs.promises
			.access(dir)
			.then(() => true)
			.catch(() => false)
		if (!dirExists) {
			res.send({ status: 'ok', sessionIds: [] })
			return
		}
		const files = await fs.promises.readdir(dir)
		res.send({ status: 'ok', sessionIds: files })
	} catch (e: any) {
		res.status(401)
		res.send({ error: e.message || e })
	}
}
