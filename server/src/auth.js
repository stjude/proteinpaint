const fs = require('fs').promises
const path = require('path')
const serverconfig = require('./serverconfig')
const jsonwebtoken = require('jsonwebtoken')

const cacheFile = path.join(serverconfig.cachedir, 'dsSessions')
const creds = serverconfig.dsCredentials
const maxSessionAge = 1000 * 3600 * 24

let sessions

/*
	One-time setup on server startup:
	- maySetAuthRoutes() will be called in app.js
		to optionally setup a middleware and login route

	Called in handle_genomes():
	- getDsAuth() will return a list of dslabels that require credentials

	Called in all requests:
	- the "gatekeeper" middleware that checks for required credentials, if applicable

	Called for login, if the client code detects, using the genomes.dsAuth[] response,
	that an active session is required
	- the '/dslogin' route handler
*/

/*
	maySetAuthRoutes() will be called in app.js
	- if there are no serverconfig.dsCredentials, will not do anything
	- will setup a middleware for most requests and the /dslogin route
*/
async function maySetAuthRoutes(app, basepath) {
	// no need to setup additional middlewares and routes
	// if there are no protected datasets
	if (!creds || !Object.keys(creds).length) return
	try {
		// 1. Get an empty or rehydrated sessions tracker object
		sessions = await getSessions()
	} catch (e) {
		throw e
	}

	// "gatekeeper" middleware that checks if a request requires
	// credentials and if yes, if there is already a valid session
	// for a ds label
	app.use((req, res, next) => {
		const q = req.query
		if (
			req.path == '/genomes' ||
			req.path == '/dslogin' ||
			req.path == '/jwt-status' ||
			!q.dslabel ||
			!(q.dslabel in creds)
		) {
			next()
			return
		}

		try {
			const id = req.cookies[`${q.dslabel}SessionId`]
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel][id]
			if (!session) throw `unestablished or expired browser session`
			const time = +new Date()
			if (time - session.time > maxSessionAge) {
				delete sessions[q.dslabel][id]
				throw 'expired browser session'
			}
			session.time = time
			next()
		} catch (e) {
			res.send({ error: e })
		}
	})

	// creates a session ID that is returned
	app.post(basepath + '/dslogin', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			if (!q.dslabel || !(q.dslabel in creds)) {
				code = 400
				throw `No login required for dataset='${q.dslabel}'`
			}

			if (!req.headers.authorization) throw 'missing authorization header'
			const [type, pwd] = req.headers.authorization.split(' ')
			if (type.toLowerCase() != 'basic') throw `unsupported authorization type='${type}', allowed: 'Basic'`
			if (Buffer.from(pwd, 'base64').toString() != creds[q.dslabel].password) throw 'invalid password'
			const id = Math.random().toString()
			const time = +new Date()
			sessions[q.dslabel][id] = { id, time }
			await fs.appendFile(cacheFile, `${q.dslabel}\t${id}\t${time}\n`)
			res.header('Set-cookie', `${q.dslabel}SessionId=${id}`)
			res.send({ status: 'ok' })
		} catch (e) {
			console.log(e, code)
			res.status(code)
			res.send({ error: e })
		}
	})

	// will not set a session
	app.post(basepath + '/jwt-status', async (req, res) => {
		let code = 401
		console.log(99)
		try {
			await checkDsSecret(req.query, req.headers)
			res.send({ status: 'ok' })
		} catch (e) {
			console.log(e, code)
			res.status(code)
			res.send({ error: e })
		}
	})
}
/*
	will return a sessions object that is used
	for tracking sessions by [dslabel]{[id]: {id, time}}
*/
async function getSessions() {
	const sessions = {}
	for (const dslabel in creds) {
		if (!sessions[dslabel]) sessions[dslabel] = {}
	}

	try {
		const file = await fs.readFile(cacheFile, 'utf8')
		//rehydrate sessions from a cached file
		const now = +new Date()
		for (const line of file.split('\n')) {
			if (!line) continue
			const [dslabel, id, _time] = line.split('\t')
			const time = Number(_time)
			if (!sessions[dslabel]) sessions[dslabel] = {}
			if (now - time < maxSessionAge) sessions[dslabel][id] = { id, time }
		}
		return sessions
	} catch (e) {
		console.log(e)
		return sessions
	}
}

/*
	will return a list of dslabels that require credentials
*/
function getDsAuth(req) {
	return Object.keys(serverconfig.dsCredentials || {}).map(dslabel => {
		const id = req.cookies[`${dslabel}SessionId`]
		const sessionStart = sessions[dslabel]?.[id]?.time || 0
		return {
			dslabel,
			insession: +new Date() - sessionStart < maxSessionAge,
			type: serverconfig.dsCredentials[dslabel].type || 'login'
		}
	})
}

function checkDsSecret(q, headers) {
	const cred = serverconfig.dsCredentials?.[q.dslabel]
	if (!cred) return
	if (!q.embedder) throw `missing q.embedder`
	if (!cred.secret[q.embedder]) throw `unknown q.embedder='${q.embedder}'`
	//console.log(165, cred.secret[q.embedder], jsonwebtoken.sign({ accessibleDatasets: ['TermdbTest', "SJLife"] }, cred.secret[q.embedder
	const token = headers[cred.headerKey]
	if (!token) throw `missing q['${cred.headerKey}']`
	const payload = jsonwebtoken.verify(token, cred.secret[q.embedder])
	//console.log(169, payload)
	if (!payload.accessibleDatasets.includes(q.dslabel)) throw `not authorized for dslabel='${q.dslabel}'`
}

module.exports = { maySetAuthRoutes, getDsAuth, checkDsSecret }
