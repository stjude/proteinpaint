import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { RouteApi } from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { authApi } from '#src/auth.js'

// a zero maxAge or maxSize for the massSession cache subdir means that the cache monitor
// would evict every saved session, so the /massSession and /sessionIds routes are not set up at all,
// to reduce the attack surface on a server that does not support saved sessions, such as for GDC
const cacheOpts = serverconfig.features?.cacheMonitor?.subdirs?.massSession
export const isDisabled = cacheOpts?.maxAge === 0 || cacheOpts?.maxSize === 0

export const api: RouteApi = {
	// saves, gets, or deletes a mass app state as a server-side session file
	endpoint: 'massSession',
	methods: {
		get: {
			init: isDisabled ? null : () => get,
			request: { typeId: 'MassSessionGetRequest' /*, checkers: TODO write validator */ },
			response: { typeId: 'MassSessionGetResponse' }
		},
		post: {
			init: isDisabled ? null : () => save,
			request: { typeId: 'MassSessionSaveRequest' },
			response: { typeId: 'MassSessionSaveResponse' }
		},
		delete: {
			init: isDisabled ? null : () => _delete,
			request: { typeId: 'MassSessionDeleteRequest' },
			response: { typeId: 'MassSessionDeleteResponse' }
		}
	}
}

const cachedir_massSession = serverconfig.cachedir_massSession || path.join(serverconfig.cachedir, 'massSession')
if (!isDisabled && !fs.existsSync(cachedir_massSession)) fs.mkdirSync(cachedir_massSession)

// the maximum size of a saved session file, in bytes; an explicit 0 rejects every save
const maxBytes = serverconfig.features?.massSessionMaxBytes ?? 1e6

async function save(req, res) {
	// POST
	try {
		const q = req.body.__sessionFor__
		const { filename, route, dslabel, embedder } = q || {}
		let payload
		if (filename) {
			const reqExtract = { headers: req.headers, query: q } //; console.log(13, reqExtract)
			payload = authApi.getPayloadFromHeaderAuth(reqExtract, route)
			if (!payload.email) throw `invalid credentials: no jwt.email`
			if (payload.dslabel != dslabel || payload.route != route || payload.embedder != embedder)
				throw `invalid credentials: mismatched payload`
			delete req.body.__sessionFor__
		}
		const sessionID = filename || makeID()
		// not checking duplicating id

		// req.body is some string data, save it to file named by the session id
		const content = JSON.stringify(req.body)
		if (Buffer.byteLength(content) > maxBytes) throw `session state is too large to save`
		const dir = filename ? getSessionPath(q, payload) : cachedir_massSession
		const dirExists = await fs.promises
			.access(dir)
			.then(() => true)
			.catch(() => false)
		if (!dirExists) {
			fs.mkdirSync(dir, { recursive: true })
		}
		await utils.write_file(getSessionFile(dir, sessionID), content)
		res.send({
			id: sessionID
		})
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}

async function get(req, res) {
	// GET

	try {
		const id = req.query.id
		if (!id) throw 'session id missing'
		const payload = req.query.route ? authApi.getPayloadFromHeaderAuth(req, req.query.route) : null //; console.log(14, payload)
		const dir = req.query.route ? getSessionPath(req.query, payload) : cachedir_massSession
		const file = getSessionFile(dir, id)
		let sessionCreationDate
		try {
			const s = await fs.promises.stat(file)
			sessionCreationDate = s.birthtime
		} catch {
			throw 'invalid session'
		}
		const stateStr = await utils.read_file(file)
		const state = JSON.parse(stateStr)
		if (req.query.route) {
			res.send({ state })
			return
		}

		//Calculate the remaining number of days before session files will be deleted
		const today = new Date()
		const fileDate = new Date(sessionCreationDate)
		const massSessionDuration = serverconfig.features.massSessionDuration || 30
		const sessionDaysLeft =
			massSessionDuration - Math.round((today.getTime() - fileDate.getTime()) / (1000 * 3600 * 24))

		res.send({
			state,
			sessionDaysLeft,
			massSessionDuration
		})
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}

// NOTE: cannot use delete as a method name, since it's a reserver js keyword
async function _delete(req, res) {
	try {
		const ids = req.query.ids
		if (!ids) throw 'session ids[] missing'
		const payload = req.query.route ? authApi.getPayloadFromHeaderAuth(req, req.query.route) : null
		if (!payload) throw 'missing credentials'
		const dir = req.query.route ? getSessionPath(req.query, payload) : cachedir_massSession
		if (!Array.isArray(ids)) throw 'session ids[] must be an array'
		// validate all ids before deleting any file
		const files = ids.map(id => getSessionFile(dir, id))
		const results = await Promise.allSettled(files.map(file => fs.promises.unlink(file)))
		// report only the failed ids, not the error messages that include server file paths
		const failedIds = ids.filter((id, i) => results[i].status == 'rejected')
		if (failedIds.length) {
			for (const [i, r] of results.entries()) {
				if (r.status == 'rejected') console.log(`massSession _delete(): ${files[i]}`, r.reason)
			}
			res.send({ error: `unable to delete session(s): ${failedIds.join(', ')}`, failedIds })
			return
		}
		res.send({ status: 'ok' })
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}

const idChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// returns a 15-character session id in [0-9A-Za-z], same format as before, from a cryptographically secure source
function makeID() {
	const lst: string[] = []
	while (lst.length < 15) lst.push(idChars[crypto.randomInt(idChars.length)])
	return lst.join('')
}

const sessionsByCredDir = path.resolve(serverconfig.cachedir, 'sessionsByCred')

// each request-derived value will be used as one dir level under sessionsByCred/,
// and must not be able to traverse to other dirs
export function getSessionPath(query, payload) {
	const { route, dslabel, embedder } = query
	if (!payload?.email) throw `invalid credentials: no jwt.email`
	if (payload.dslabel != dslabel || payload.route != route || payload.embedder != embedder)
		throw `invalid credentials: mismatched payload`
	const email = payload.email.replace('@', '_at_')
	for (const segment of [embedder, email, route, dslabel]) {
		if (utils.illegalPathSegment(segment)) throw 'invalid session path'
	}
	const dir = path.resolve(sessionsByCredDir, embedder, email, route, dslabel)
	if (!dir.startsWith(sessionsByCredDir + path.sep)) throw 'invalid session path'
	return dir
}

function getSessionFile(dir, id) {
	if (utils.illegalPathSegment(id)) throw 'invalid session id'
	const file = path.resolve(dir, id)
	if (path.dirname(file) != path.resolve(dir)) throw 'invalid session id'
	return file
}
