import fs from 'fs'
import path from 'path'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
import { authApi } from './auth.js'

const cachedir_massSession = serverconfig.cachedir_massSession || path.join(serverconfig.cachedir, 'massSession')
if (!fs.existsSync(cachedir_massSession)) fs.mkdirSync(cachedir_massSession)

export async function save(req, res) {
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
		const dir = filename ? getSessionPath(q, payload) : cachedir_massSession
		const dirExists = await fs.promises
			.access(dir)
			.then(() => true)
			.catch(() => false)
		if (!dirExists) {
			fs.mkdirSync(dir, { recursive: true })
		}
		await utils.write_file(path.join(dir, sessionID), content)
		res.send({
			id: sessionID
		})
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

export async function get(req, res) {
	// GET

	try {
		const id = req.query.id
		if (!id) throw 'session id missing'
		const { route, dslabel, embedder } = req.query
		const payload = req.query.route ? authApi.getPayloadFromHeaderAuth(req, req.query.route) : null //; console.log(14, payload)
		const dir = req.query.route ? getSessionPath(req.query, payload) : cachedir_massSession
		const file = path.join(dir, id)
		let sessionCreationDate
		try {
			const s = await fs.promises.stat(file)
			sessionCreationDate = s.birthtime
		} catch (e) {
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
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

// NOTE: cannot use delete as a method name, since it's a reserver js keyword
export async function _delete(req, res) {
	try {
		const ids = req.query.ids
		if (!ids) throw 'session ids[] missing'
		const { route, dslabel, embedder } = req.query
		const payload = req.query.route ? authApi.getPayloadFromHeaderAuth(req, req.query.route) : null
		if (!payload) throw 'missing credentials'
		const dir = req.query.route ? getSessionPath(req.query, payload) : cachedir_massSession
		const errors = []
		for (const id of ids) {
			const file = path.join(dir, id)
			fs.unlink(file, err => {
				if (err) {
					errors.push(err)
					throw err
				}
			})
		}
		if (!errors.length) res.send({ status: 'ok' })
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

export async function getSessionIdsByCred(req, res) {
	try {
		const { filename, route, dslabel, embedder } = req.query
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
	} catch (e) {
		res.status(401)
		res.send({ error: e.message || e })
	}
}

function makeID() {
	/*
	to come up with a character in the session string, get an integer in the following range and convert to char
	decimal to char range:
		48-57: 0-9
		65-90: A-Z
		97-122: a-z
	*/
	const lst = []
	while (lst.length < 15) {
		const i = 46 + Math.floor(80 * Math.random())
		if ((i >= 48 && i <= 57) || (i >= 65 && i <= 90) || (i >= 97 && i <= 122)) {
			lst.push(String.fromCharCode(i))
		}
	}
	return lst.join('')
}

function getSessionPath(query, payload) {
	const { filename, route, dslabel, embedder } = query
	const email = payload.email.replace('@', '_at_')
	return `${serverconfig.cachedir}/sessionsByCred/${embedder}/${email}/${route}/${dslabel}`
}
