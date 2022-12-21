const fs = require('fs').promises
const existsSync = require('fs').existsSync
const path = require('path')
const jsonwebtoken = require('jsonwebtoken')
// TODO: may use this once babel is configured to transpile es6 node_modules
//const sleep = require('./utils').sleep
const processors = require('./custom-jwt-processors.js')

// TODO: may use utils.sleep
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

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
async function maySetAuthRoutes(app, basepath = '', _serverconfig = null) {
	const serverconfig = _serverconfig || require('./serverconfig')
	const sessionsFile = path.join(serverconfig.cachedir, 'dsSessions')
	const actionsFile = path.join(serverconfig.cachedir, 'authorizedActions')
	const creds = serverconfig.dsCredentials

	const maxSessionAge = serverconfig.maxSessionAge || 1000 * 3600 * 16
	let sessions

	// no need to setup additional middlewares and routes
	// if there are no protected datasets
	if (!creds || !Object.keys(creds).length) return

	/* !!! app.use() must be called before route setters and await !!! */

	// "gatekeeper" middleware that checks if a request requires
	// credentials and if yes, if there is already a valid session
	// for a ds label
	app.use((req, res, next) => {
		const q = req.query
		if (
			q.dslabel &&
			q.dslabel in creds &&
			req.path != '/dslogin' &&
			(creds[q.dslabel].type != 'jwt' || (req.path == '/termdb' && q.for == 'matrix'))
		) {
			// will do the session check below
		} else {
			//console.log([64, '----- AUTH MIDDLEWARE -----', req.path, req.for])
			next()
			return
		}

		try {
			const id = getSessionId(req)
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel][id]
			const ip = req.ip // || req.ips
			if (!session) throw `unestablished or expired browser session`
			if (session.ip != ip) throw `invalid session ip address [${session.ip} vs ${ip}]`

			const time = Date.now()
			/* !!! TODO: may rethink the following assumption !!!
				assumes that the payload.datasets list will not change within the maxSessionAge duration
				including between subsequent checks of jwts, in order to avoid potentially expensive decryption 
			*/
			if (time - session.time > maxSessionAge) {
				const { iat } = checkDsSecret(q, req.headers, creds, session)
				const elapsedSinceIssue = time - iat
				if (elapsedSinceIssue > maxSessionAge) {
					delete sessions[q.dslabel][id]
					throw 'Please login again to access this feature. (expired session)'
				}
				if (elapsedSinceIssue < 300000) {
					// this request is accompanied by a new jwt
					session.time = time
					return
				}
			}

			// TODO: may not to adjust session expiration based on the last active period
			// If any activity happens within the harcoded number of milliseconds below,
			// then update the start time of the active session (account for prolonged user inactivity)
			if (session.time - time < 900) session.time = time
			next()
		} catch (e) {
			res.send(typeof e == 'object' ? e : { error: e })
		}
	})

	/*** call app.use() before setting routes ***/

	try {
		// 1. Get an empty or rehydrated sessions tracker object
		sessions = await getSessions(creds, sessionsFile, maxSessionAge)
	} catch (e) {
		throw e
	}

	// app.use() from other route setters must be called before app.get|post|all
	// so delay setting these optional routes (this is done in server/src/test/routes/gdc.js also)
	await sleep(0)

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
			await setSession(q, res, sessions, sessionsFile, req)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/jwt-status', async (req, res) => {
		let code = 401
		try {
			const { email, ip } = await checkDsSecret(req.query, req.headers, creds)
			const id = await setSession(req.query, res, sessions, sessionsFile, email, req)
			// difficule to setup CORS cookie, will simply reply with cookie and use a custom header for now
			res.send({ status: 'ok', 'X-SjPPDs-Sessionid': id })
		} catch (e) {
			res.status(code)
			res.send(e instanceof Error || typeof e != 'object' ? { error: e } : e)
		}
	})

	app.post(basepath + '/authorizedActions', async (req, res) => {
		const q = req.query
		try {
			const id = getSessionId(req)
			const { email } = sessions[q.dslabel][id]
			const time = new Date()
			await fs.appendFile(actionsFile, `${q.dslabel}\t${email}\t${time}\t${q.action}\t${JSON.stringify(q.details)}\n`)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(401)
			res.send(typeof e == 'object' ? e : { error: e })
		}
	})

	/*
		will return a list of dslabels that require credentials
	*/
	authApi.getDsAuth = function(req) {
		return Object.keys(creds || {}).map(dslabel => {
			try {
				const cred = creds[dslabel]
				const id = getSessionId(req)
				const sessionStart = sessions[dslabel]?.[id]?.time || 0
				return {
					dslabel,
					// type='jwt' will require a token in the initial runpp call
					insession: (cred.type != 'jwt' || id) && Date.now() - sessionStart < maxSessionAge,
					type: cred.type || 'login'
				}
			} catch (e) {
				throw e
			}
		})
	}
}

function getSessionId(req) {
	return (
		req.cookies[`${req.query.dslabel}SessionId`] || req.get('X-SjPPDs-Sessionid') || req.query['X-SjPPDs-Sessionid']
	)
}

/*
	will return a sessions object that is used
	for tracking sessions by [dslabel]{[id]: {id, time}}
*/
async function getSessions(creds, sessionsFile, maxSessionAge) {
	const sessions = {}
	for (const dslabel in creds) {
		if (!sessions[dslabel]) sessions[dslabel] = {}
	}

	try {
		const file = await fs.readFile(sessionsFile, 'utf8')
		//rehydrate sessions from a cached file
		const now = +new Date()
		for (const line of file.split('\n')) {
			if (!line) continue
			const [dslabel, id, _time, email, ip] = line.split('\t')
			const time = Number(_time)
			if (!sessions[dslabel]) sessions[dslabel] = {}
			if (now - time < maxSessionAge) sessions[dslabel][id] = { id, time, email, ip }
		}
		return sessions
	} catch (e) {
		// ok for the session backup to not exists, will be created later as needed
		if (existsSync(sessionsFile)) console.log(e)
		return sessions
	}
}

async function setSession(q, res, sessions, sessionsFile, email, req) {
	const time = Date.now()
	const id = Math.random().toString() + '.' + time.toString().slice(4)
	const ip = req.ip // may use req.ips?
	if (!sessions[q.dslabel]) sessions[q.dslabel] = {}
	sessions[q.dslabel][id] = { id, time, email, ip }
	await fs.appendFile(sessionsFile, `${q.dslabel}\t${id}\t${time}\t${email}\n${ip}`)
	res.header('Set-Cookie', `${q.dslabel}SessionId=${id}; HttpOnly; SameSite=None; Secure`)
	return id
}

/*
	Arguments
	creds: serverconfig.dsCredentials
*/
function checkDsSecret(q, headers, creds = {}, _time, session = null) {
	const cred = creds[q.dslabel]
	if (!cred) return
	if (!q.embedder) throw `missing q.embedder`
	const embedder = cred.embedders[q.embedder]
	if (!embedder) throw `unknown q.embedder='${q.embedder}'`
	const secret = embedder.secret
	if (!secret) throw `missing embedder setting`

	const time = Math.floor((_time || Date.now()) / 1000)
	//for testing only
	/*console.log(
		251,
		secret,
		jsonwebtoken.sign(
			{
				iat: time,
				exp: time + 3600,
				datasets: ['TermdbTest', 'SJLife', 'PNET', 'sjlife', 'ccss'],
				email: 'username@test.tld',
				ip: '127.0.0.1'
			},
			secret
		)
	)*/

	const rawToken = headers[cred.headerKey]
	if (!rawToken) throw `missing header['${cred.headerKey}']`
	const prepjwt = embedder.prepjwt ? processors[embedder.prejwt] : null
	// the embedder may supply a pre-processor function, such as to decrypt a fully encrypted jwt
	const token = prepjwt ? preprocessor(rawToken) : rawToken

	// this verification will throw if the token is invalid in any way
	const payload = jsonwebtoken.verify(token, secret)
	// if there is a session, handle the expiration outside of this function
	if (session) return { iat: payload.iat, email: payload.email, ip: payload.ip }

	// the embedder may refer to a post-processor function to
	// optionally transform, translate, reformat the payload
	if (embedder.postjwt) {
		try {
			processors[embedder.postjwt](embedder, payload, time)
		} catch (e) {
			if (e.reason == 'bad decrypt') throw `Please login again to access this feature. (${e.reason})`
			throw e
		}
	}

	if (time > payload.exp) throw `Please login again to access this feature. (expired token)`

	const dsnames = embedder.dsnames || [q.dslabel]
	const missingAccess = dsnames.filter(d => !payload.datasets.includes(d.id)).map(d => d.id)
	if (missingAccess.length) {
		throw { error: 'Missing access', linkKey: missingAccess.join(',') }
	}
	return { iat: payload.iat, email: payload.email, ip: payload.ip }
}

/* NOTE: maySetAuthRoutes could replace api.getDsAuth() and .hasActiveSession() */
const authApi = { maySetAuthRoutes, checkDsSecret, getDsAuth: () => [], hasActiveSession: () => true }
module.exports = authApi
