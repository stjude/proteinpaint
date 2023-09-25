const fs = require('fs').promises
const existsSync = require('fs').existsSync
const path = require('path')
const jsonwebtoken = require('jsonwebtoken')
const micromatch = require('micromatch')
// TODO: may use this once babel is configured to transpile es6 node_modules
//const sleep = require('./utils').sleep

// TODO: may use utils.sleep
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

// serverconfig.dsCredentials
//
// DsCredentials = {
// 	/** optional filepath of a secrets json file
//   *  the default is to use the secrets object if provided
//   */
// 	secrets: string

// 	// NOTES:
// 	// 1. list keys in the desired matching order, for example, the catch-all '*' pattern should be entered last
// 	// 2. glob pattern: '*', '!', etc

// 	// the dslabel can be a glob pattern, to find any matching dslabel
// 	[dslabel: string]: {
// 		// the hostName can be a glob pattern, to find any matching embedder host name
// 		[serverRoute: string]: {
// 			// serverRoute can be a glob pattern, to find any matching server route name/path
// 			[hostName: string]:
//         'secrets-object-key' |
//         { type: 'basic', password: '...'} |
//         {
//            type: 'jwt',
//            secret: string,
//            // optional list of cohort(s) that a user must have access to,
//            // to be matched against the jwt payload as signed by the embedder
//            dsnames: [{id, label}]
//         } |
//         // TODO: support other credential types
// 		}
// 	}
// }

// Examples:

// dsCredentials: {
// 	secrets: 'secrets', // pragma: allowlist secret
// 	SJLife: {
// 		termdb: {
// 			'viz.stjude.cloud': 'vizcomJwt',
// 		},
// 		burden: {
// 			'*: 'burdenDemo'
// 		}
// 	},
// 	PNET: {
// 		'*': { // equivalent to /**/*
// 			'*': {
//         type: 'basic',
//         password: '...'
//      }
// 		}
// 	},
//
//  NOTE: if none of the above patterns were matched against the current request,
// 	then any credential with wildcards may be applied instead,
// 	but only if these 'default' protections are specified as a dsCredential (sub)entry
// 	'*': { // apply the following creds to all datasets
// 		'*': { // apply the following creds for all server routes
// 			'*': 'defaultCred'
// 		}
// 	}
// }

// secrets: {
// 	vizcomJwt: {
// 		type: "jwt"
// 	},
// 	burdenDemo: {
// 		type: 'basic',
//    password: '...'
// 	}
// }

function matchedDslabelPattern(key) {
	for (const pattern of this.__dslabels__) {
		if (micromatch.isMatch(key, pattern)) return pattern
	}
}

function matchedRoutePattern(key) {
	for (const pattern of this.__routes__) {
		if (micromatch.isMatch(key, pattern)) return pattern
	}
}

function matchedEmbedderPattern(key) {
	for (const pattern of this.__embedders__) {
		if (micromatch.isMatch(key, pattern)) return pattern
	}
}

async function validateDsCredentials(creds, serverconfig) {
	mayReshapeDsCredentials(creds)
	const key = 'secrets' // to prevent a detect secrets issue
	if (typeof creds[key] == 'string') {
		const json = await fs.readFile(sessionsFile, 'utf8')
		creds[key] = JSON.parse(json)
	}

	for (const dslabel in creds) {
		const ds = creds[dslabel]
		if (ds['*']) {
			ds['/**'] = ds['*']
			delete ds['*']
		}
		// if (ds.termdb) {
		// 	ds['termdb/for=(matrix|singleSampleData|getAllSamples)'] = ds.termdb
		// 	delete ds.termdb
		// }
		for (const serverRoute in ds) {
			const route = ds[serverRoute]
			for (const embedderHost in route) {
				const c = route[embedderHost]
				const cred = typeof c == 'string' ? creds.secrets[c] : c
				// copy the server route pattern to easily obtain it from within the cred
				if (cred.type == 'basic') {
					// NOTE: an empty password will be considered as forbidden
					//if (!cred.password)
					//throw `missing password for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}], type: '${cred.type}'`
				} else if (cred.type == 'jwt') {
					// NOTE: an empty secret will be considered as forbidden
					//if (!cred.secret)
					//throw `missing secret for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}], type: '${cred.type}'`
					// TODO: this headerKey should be unique to a dslabel + route, to avoid conflicts
					if (!cred.headerKey) cred.headerKey = 'x-ds-access-token'
				} else if (cred.type) {
					throw `unknown cred.type='${cred.type}' for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}]`
				}
				cred.route = serverRoute
				cred.authRoute = authRouteByCredType[cred.type]
			}
			route.__embedders__ = Object.keys(route)
			route.matchedEmbedderPattern = matchedEmbedderPattern
		}
		ds.__routes__ = Object.keys(ds)
		ds.matchedRoutePattern = matchedRoutePattern
	}
	creds.__dslabels__ = Object.keys(creds).filter(k => k != 'secrets')
	creds.matchedDslabelPattern = matchedDslabelPattern
}

function mayReshapeDsCredentials(creds) {
	// reshape legacy
	for (const dslabel in creds) {
		const cred = creds[dslabel]
		if (cred.type == 'login') {
			if (cred.embedders) throw `unexpected 'embedders' property`
			// known format where type: 'login' does not have the jwt-type properties below
			cred['*'] = {
				'*': {
					type: 'basic',
					password: cred.password
				}
			}
			delete cred.type
			delete cred.password
		} else if (cred.type == 'jwt') {
			// known format where type: 'jwt' does not have the login properties above
			for (const hostName in cred.embedders) {
				cred.termdb = {
					[hostName]: Object.assign({ type: cred.type }, cred.embedders[hostName])
				}
				if (cred.headerKey) {
					cred.termdb[hostName].headerKey = cred.headerKey
				}
			}
			delete cred.type
			delete cred.embedders
			delete cred.headerKey
		} else if (cred.type) {
			throw `unknown legacy credentials type='${cred.type}'`
		}
	}
}

const protectedTermdbRoutes = {
	termdb: ['matrix', 'singleSampleData', 'getAllSamples']
}

const authRouteByCredType = {
	basic: '/dslogin',
	jwt: '/jwt-status'
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
	try {
		validateDsCredentials(creds, serverconfig)
	} catch (e) {
		throw e
	}

	function getRequiredCred(q, path) {
		if (!q.dslabel) return
		// faster exact matching, based on known protected routes
		const ds0 = creds[q.dslabel] || creds['*']
		if (ds0) {
			// const route = ds0.termdb || ds0.burden || ds0['/**']
			// if (!route) return; console.log(242, path, route)
			if (path == '/jwt-status') {
				const route = ds0[q.route] || ds0['termdb'] || ds0['/**']
				return route && (route[q.embedder] || route['*'])
			} else if (path == '/login') {
				const route = ds0[q.route || '*']
				return route && (route[q.embedder] || route['*'])
			} else if (path.startsWith('/termdb') && ds0.termdb) {
				const route = ds0.termdb
				// okay to return an undefined embedder[route]
				return protectedTermdbRoutes.termdb.includes(q.for) && (route[q.embedder] || route['*'])
			} else if (path.startsWith('/burden') && ds0.burden) {
				// okay to return an undefined embedder[route]
				return ds0.burden[q.embedder] || ds0.burden['*']
			} /*else { console.log(249, route)
				// okay to return an undefined embedder[route]
				return route[q.embedder] || route['*']
			}*/
		}
		// wildcard matching
		const matchedDslabel = creds.matchedDslabelPattern(q.dslabel)
		if (!matchedDslabel) return
		const ds = creds[matchedDslabel]
		const matchedRoute = ds.matchedRoutePattern(path)
		if (!matchedRoute) return
		const route = ds[matchedRoute]
		const matchedEmbedder = route.matchedEmbedderPattern(q.embedder)
		if (!matchedEmbedder) return
		return route[matchedEmbedder]
	}

	/* !!! app.use() must be called before route setters and await !!! */

	// "gatekeeper" middleware that checks if a request requires
	// credentials and if yes, if there is already a valid session
	// for a ds label
	app.use((req, res, next) => {
		if (req.path == '/dslogin' || req.path == '/jwt-status') {
			next()
			return
		}
		const q = req.query
		const cred = getRequiredCred(q, req.path)
		if (!cred) {
			next()
			return
		}
		try {
			const id = getSessionId(req)
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel][id]
			if (!session) throw `unestablished or expired browser session`
			//if (!session.email) throw `missing session details: please login again through a supported portal`
			checkIPaddress(req, session.ip)

			const time = Date.now()
			/* !!! TODO: may rethink the following assumption !!!
				assumes that the payload.datasets list will not change within the maxSessionAge duration
				including between subsequent checks of jwts, in order to avoid potentially expensive decryption 
			*/
			if (time - session.time > maxSessionAge) {
				const { iat } = getJwtPayload(q, req.headers, cred, session)
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
		const unexpiredSessions = []
		for (const dslabel in sessions) {
			for (const id in sessions[dslabel]) {
				const q = sessions[dslabel][id]
				unexpiredSessions.push(`${q.dslabel}\t${q.id}\t${q.time}\t${q.email}\t${q.ip}\t${q.embedder}\t{q.route}`)
			}
		}
		// update the sessionsFile content so only unexpiredSessions are recorded
		await fs.writeFile(sessionsFile, unexpiredSessions.join('\n'))
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
			const cred = getRequiredCred(q, req.path)
			if (!cred) {
				code = 400
				throw `No login required for dataset='${q.dslabel}'`
			}
			if (cred.authRoute != '/dslogin') {
				code = 400
				throw `Incorrect authorization route, use ${cred.authRoute}'`
			}
			if (!req.headers.authorization) throw 'missing authorization header'
			const [type, pwd] = req.headers.authorization.split(' ')
			if (type.toLowerCase() != 'basic') throw `unsupported authorization type='${type}', allowed: 'Basic'`
			if (Buffer.from(pwd, 'base64').toString() != cred.password) throw 'invalid password'
			await setSession(q, res, sessions, sessionsFile, '', req, cred)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	// creates a session ID that is returned
	app.post(basepath + '/dslogout', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			const id = getSessionId(req)
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel][id]
			delete sessions[q.dslabel][id]
			const ip = req.ip
			await fs.appendFile(
				sessionsFile,
				`${q.dslabel}\t${id}\t0\t\t${session.ip}\t${session.embedder}\t{session.route}\n`
			)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/jwt-status', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			const cred = getRequiredCred(q, req.path)
			if (!cred) return
			if (cred.authRoute != '/jwt-status') {
				code = 400
				throw `Incorrect authorization route, use ${cred.authRoute}'`
			}
			const { email, ip } = await getJwtPayload(q, req.headers, cred)
			checkIPaddress(req, ip)
			const id = await setSession(q, res, sessions, sessionsFile, email, req, cred)
			// difficult to setup CORS cookie, will simply reply with cookie and use a custom header for now
			res.send({ status: 'ok', 'x-sjppds-sessionid': id })
		} catch (e) {
			console.log(e)
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
	authApi.getDsAuth = function (req) {
		const dsAuth = []
		const embedder = req.get('host').split(':')[0]
		for (const dslabelPattern in creds) {
			if (dslabelPattern.startsWith('__')) continue
			const ds = creds[dslabelPattern]
			for (const routePattern in ds) {
				const route = ds[routePattern]
				for (const embedderHostPattern in route) {
					if (!micromatch.isMatch(embedder, embedderHostPattern)) continue
					const cred = route[embedderHostPattern]
					const query = Object.assign({}, req.query, { dslabel: dslabelPattern })
					const id = getSessionId({ query, headers: req.headers, cookies: req.cookies })
					const activeSession = sessions[dslabelPattern]?.[id]
					const sessionStart = activeSession?.time || 0
					dsAuth.push({
						dslabel: dslabelPattern,
						route: routePattern,
						type: cred.type || 'basic',
						insession:
							cred.type == 'basic' ? false : (cred.type != 'jwt' || id) && Date.now() - sessionStart < maxSessionAge
					})
				}
			}
		}
		return dsAuth
	}
}

function getSessionId(req) {
	// embedder sites may use HTTP 2.0 which requires lowercased header key names
	// using all lowercase is compatible for both http 1 and 2
	return (
		req.cookies?.[`${req.query.dslabel}SessionId`] ||
		req.headers['x-sjppds-sessionid'] ||
		req.query['x-sjppds-sessionid']
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

async function setSession(q, res, sessions, sessionsFile, email, req, cred) {
	const time = Date.now()
	const id = Math.random().toString() + '.' + time.toString().slice(4)
	const ip = req.ip // may use req.ips?
	if (!sessions[q.dslabel]) sessions[q.dslabel] = {}
	sessions[q.dslabel][id] = { id, time, email, ip }
	await fs.appendFile(sessionsFile, `${q.dslabel}\t${id}\t${time}\t${email}\t${ip}\t${q.embedder}\t{cred.route}\n`)
	if (!cred.cookieMode || cred.cookieMode == 'set-cookie') {
		res.header('Set-Cookie', `${q.dslabel}SessionId=${id}; HttpOnly; SameSite=None; Secure`)
	}
	return id
}

/*
	Arguments
	cred: object returned by getRequiredCred

	NOTE: see public/example.mass.html to test using a token generated by
	./server/test/fake-jwt.js [dslabel=TermdbTest]
*/
function getJwtPayload(q, headers, cred, _time, session = null) {
	if (!cred) return
	if (!q.embedder) throw `missing q.embedder`
	// const embedder = cred.embedders[q.embedder]
	// if (!embedder) throw `unknown q.embedder='${q.embedder}'`
	const secret = cred.secret
	if (!secret)
		throw {
			status: 'error',
			error: `no credentials set up for this embedder`,
			code: 403
		}
	const time = Math.floor((_time || Date.now()) / 1000)

	const rawToken = headers[cred.headerKey]
	if (!rawToken) throw `missing header['${cred.headerKey}']`

	// the embedder may supply a processor function
	const processor = cred.processor ? __non_webpack_require__(cred.processor) : {}

	// use a handleToken() if available for an embedder, for example to decrypt a fully encrypted jwt
	const token = processor.handleToken?.(rawToken) || rawToken
	// this verification will throw if the token is invalid in any way
	const payload = jsonwebtoken.verify(token, secret)
	// if there is a session, handle the expiration outside of this function
	if (session) return { iat: payload.iat, email: payload.email, ip: payload.ip }

	// the embedder may use a post-processor function to
	// optionally transform, translate, reformat the payload
	if (processor.handlePayload) {
		try {
			processor.handlePayload(cred, payload, time)
		} catch (e) {
			//console.log(e)
			if (e.reason == 'bad decrypt') throw `Please login again to access this feature. (${e.reason})`
			throw e
		}
	}

	if (time > payload.exp) throw `Please login again to access this feature. (expired token)`

	const dsnames = cred.dsnames || [q.dslabel]
	const missingAccess = dsnames.filter(d => !payload.datasets.includes(d.id)).map(d => d.id)
	if (missingAccess.length) {
		throw { error: 'Missing access', linkKey: missingAccess.join(',') }
	}
	return { iat: payload.iat, email: payload.email, ip: payload.ip }
}

function checkIPaddress(req, ip) {
	// must have a serverconfig.appEnable: ['trust proxy'] entry
	if (!ip) throw `Server error: missing ip address in saved session`
	if (req.ip != ip && req.ips?.[0] != ip && req.connection?.remoteAddress != ip)
		throw `Your connection has changed, please refresh your page or sign in again.`
}

function userCanAccess(req, ds) {
	const authds = authApi.getDsAuth(req).find(d => d.dslabel == ds.label)
	if (!authds) return true
	return authds.insession
}

/* NOTE: maySetAuthRoutes could replace api.getDsAuth() and .hasActiveSession() */
const authApi = {
	maySetAuthRoutes,
	getJwtPayload,
	// this may be replaced
	getDsAuth: () => [],
	canDisplaySampleIds: (req, ds) => {
		if (!ds.cohort.termdb.displaySampleIds) return false
		return userCanAccess(req, ds)
	},
	userCanAccess
}
module.exports = authApi
