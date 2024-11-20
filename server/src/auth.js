import { existsSync, promises as fs } from 'fs'
import path from 'path'
import jsonwebtoken from 'jsonwebtoken'
import mm from 'micromatch'

const { isMatch } = mm
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

async function validateDsCredentials(creds, serverconfig) {
	mayReshapeDsCredentials(creds)
	const key = 'secrets' // to prevent a detect-secrets hook issue
	if (typeof creds[key] == 'string') {
		const json = await fs.readFile(creds[key], 'utf8')
		creds[key] = JSON.parse(json)
	}

	for (const dslabel in creds) {
		const ds = creds[dslabel]
		if (ds['*']) {
			ds['/**'] = ds['*']
			delete ds['*']
		}
		const headerKey = ds.headerKey || 'x-ds-access-token'
		delete ds.headerKey

		for (const serverRoute in ds) {
			const route = ds[serverRoute]
			for (const embedderHost in route) {
				// create a copy from the original in case it's shared across different dslabels/routes/embedders,
				// since additional properties may be added to the object that is specific to a dslabel/route/embedder
				route[embedderHost] = JSON.parse(JSON.stringify(route[embedderHost]))
				const c = route[embedderHost]
				const cred = typeof c == 'string' ? creds.secrets[c] : c
				// copy the server route pattern to easily obtain it from within the cred
				if (cred.type == 'basic') {
					if (!cred.secret) cred.secret = cred.password
					cred.authRoute = '/dslogin'
					// NOTE: an empty password will be considered as forbidden
					//if (!cred.password)
					//throw `missing password for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}], type: '${cred.type}'`
				} else if (cred.type == 'jwt') {
					cred.authRoute = '/jwt-status'
					// NOTE: an empty secret will be considered as forbidden
					//if (!cred.secret)
					//throw `missing secret for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}], type: '${cred.type}'`
					// TODO: this headerKey should be unique to a dslabel + route, to avoid conflicts
					if (!cred.headerKey) cred.headerKey = headerKey
					if (cred.processor) cred.processor = (await import(cred.processor))?.default
				} else if (cred.type != 'forbidden' && cred.type != 'open') {
					throw `unknown cred.type='${cred.type}' for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}]`
				}
				cred.dslabel = dslabel
				cred.route = serverRoute
				cred.cookieId = (serverRoute == 'termdb' && cred.headerKey) || `${dslabel}-${serverRoute}-${embedderHost}-Id`
			}
		}
	}
}

function mayReshapeDsCredentials(creds) {
	// reshape legacy
	for (const dslabel in creds) {
		const cred = creds[dslabel]
		if (cred.type == 'login') {
			if (cred.embedders) throw `unexpected 'embedders' property`
			// known format where type: 'login' does not have the jwt-type properties below
			// apply to all routes and embedders
			cred['*'] = {
				'*': {
					type: 'basic',
					password: cred.password,
					secret: cred.secret
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

// TODO: should create a checker function for each route that may be protected
const protectedRoutes = {
	termdb: ['matrix'],
	samples: ['singleSampleData', 'getAllSamples', 'scatter', 'convertSampleId', 'getSamplesByName']
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
	const sessionTracking = serverconfig.features?.sessionTracking || ''
	const sessionsFile = path.join(serverconfig.cachedir, 'dsSessions')
	const actionsFile = path.join(serverconfig.cachedir, 'authorizedActions')
	const creds = serverconfig.dsCredentials || {}
	// !!! do not expose the loaded dsCredentials to other code that imports serverconfig.json !!!
	delete serverconfig.dsCredentials

	const maxSessionAge = serverconfig.maxSessionAge || 1000 * 3600 * 16
	let sessions

	// no need to setup additional middlewares and routes
	// if there are no protected datasets
	if (!creds || !Object.keys(creds).length) {
		// open-access methods
		authApi.getDsAuth = () => []
		authApi.getForbiddenRoutesForDsEmbedder = () => []
		authApi.userCanAccess = () => true
		authApi.getRequiredCredForDsEmbedder = () => undefined
		authApi.getPayloadFromHeaderAuth = () => ({})
		return
	}
	try {
		validateDsCredentials(creds, serverconfig)
	} catch (e) {
		throw e
	}

	function getRequiredCred(q, path, _protectedRoutes) {
		if (!q.dslabel) return
		// faster exact matching, based on known protected routes
		const ds0 = creds[q.dslabel] || creds['*']
		if (ds0) {
			if (path == '/jwt-status') {
				const route = ds0[q.route] || ds0['termdb'] || ds0['/**']
				return route && (route[q.embedder] || route['*'])
			} else if (path == '/dslogin') {
				const route = ds0[q.route] || ds0['/**']
				return route && (route[q.embedder] || route['*'])
			} else if (path.startsWith('/termdb') && ds0.termdb) {
				const route = ds0.termdb
				// okay to return an undefined embedder[route]
				const protRoutes = _protectedRoutes || protectedRoutes.termdb
				return protRoutes.includes(q.for) && (route[q.embedder] || route['*'])
			} else if (path.startsWith('/burden') && ds0.burden) {
				// okay to return an undefined embedder[route]
				return ds0.burden[q.embedder] || ds0.burden['*']
			}
		}

		for (const dslabel in creds) {
			if (dslabel != q.dslabel && dslabel != '*') continue
			const ds = creds[dslabel]
			for (const routeName in ds) {
				const routePattern = ds[routeName].routePattern || routeName
				if (!isMatch(path, routePattern)) continue
				const route = ds[routeName]
				for (const embedderHost in route) {
					if (embedderHost != q.embedder && embedderHost != '*') continue
					return route[embedderHost]
				}
			}
		}
	}

	/* !!! app.use() must be called before route setters and await !!! */

	// "gatekeeper" middleware that checks if a request requires
	// credentials and if yes, if there is already a valid session
	// for a ds label
	app.use((req, res, next) => {
		if (req.path == '/dslogin' || req.path == '/jwt-status' || req.path == '/dslogout') {
			next()
			return
		}
		const q = req.query
		const cred = getRequiredCred(q, req.path)
		if (!cred) {
			next()
			return
		}
		let code
		// may configure to avoid in-memory session tracking, to simulate a multi-server process setup
		if (sessionTracking == 'jwt-only') sessions = {}
		try {
			const id = getSessionId(req, cred)
			let altId
			if (!id) {
				if (req.method.toUpperCase() == 'OPTIONS') {
					res.status(204)
					res.send()
					return
				} else {
					altId = mayAddSessionFromJwt(sessions, q.dslabel, id, req, cred)
					if (!altId) {
						code = 401
						throw 'missing session cookie'
					}
				}
			}
			// a previous /dslogin to a particular server process may have set a session id that has since expired or become stale,
			// in that case use, the Bearer jwt from the authorization header
			if (!altId) altId = mayAddSessionFromJwt(sessions, q.dslabel, id, req, cred)
			const session = sessions[q.dslabel]?.[id] || sessions[q.dslabel]?.[altId]
			if (!session) {
				code = 401
				throw `unestablished or expired browser session`
			}
			//if (!session.email) throw `missing session details: please login again through a supported portal`
			checkIPaddress(req, session.ip, cred)

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
			console.log(e)
			const _code = e.code || code
			if (_code) res.status(_code)
			res.send(typeof e == 'object' ? e : { error: e })
		}
	})

	/*** call app.use() before any await lines ***/

	try {
		// 1. Get an empty or rehydrated sessions tracker object
		sessions = await getSessions(creds, sessionsFile, maxSessionAge)
		const unexpiredSessions = []
		for (const dslabel in sessions) {
			for (const id in sessions[dslabel]) {
				const q = sessions[dslabel][id]
				unexpiredSessions.push(`${q.dslabel}\t${q.id}\t${q.time}\t${q.email}\t${q.ip}\t${q.embedder}\t${q.route}`)
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
				throw `Incorrect authorization route, use '${cred.authRoute}'`
			}
			if (!req.headers.authorization) throw 'missing authorization header'
			const [type, pwd] = req.headers.authorization.split(' ')
			if (type.toLowerCase() != 'basic') throw `unsupported authorization type='${type}', allowed: 'Basic'`
			if (Buffer.from(pwd, 'base64').toString() != cred.password) throw 'invalid password'
			const id = await setSession(q, res, sessions, sessionsFile, '', req, cred)
			code = 401 // in case of jwt processing error
			const jwt = await getSignedJwt(req, q, id, cred, maxSessionAge, sessionsFile)
			res.send({ status: 'ok', jwt, route: cred.route })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/dslogout', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			const cred = getRequiredCred(q, req.path)
			const id = getSessionId(req, cred)
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel]?.[id]
			if (!session) {
				res.send({ status: 'ok' })
				return
			}
			delete sessions[q.dslabel][id]
			const ip = req.ip
			await fs.appendFile(
				sessionsFile,
				`${q.dslabel}\t${id}\t0\t\t${session.ip}\t${session.embedder}\t${session.route}\n`
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
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			if (cred.authRoute != '/jwt-status') {
				code = 400
				throw `Incorrect authorization route, use ${cred.authRoute}'`
			}
			const { email, ip } = getJwtPayload(q, req.headers, cred)
			checkIPaddress(req, ip, cred)
			const id = await setSession(q, res, sessions, sessionsFile, email, req, cred)
			code = 401 // in case of jwt processing error
			const jwt = await getSignedJwt(req, q, id, cred, maxSessionAge, sessionsFile, email)
			// difficult to setup CORS cookie, will simply reply with cookie and use a custom header for now
			res.send({ status: 'ok', jwt, route: cred.route, [cred.cookieId]: id })
		} catch (e) {
			console.log(e)
			res.status(code)
			res.send(e instanceof Error || typeof e != 'object' ? { error: e } : e)
		}
	})

	app.post(basepath + '/authorizedActions', async (req, res) => {
		const q = req.query
		try {
			// TODO: later, other routes besides /termdb may require tracking
			const cred = getRequiredCred(q, 'termdb')
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			const id = getSessionId(req)
			const altId = mayAddSessionFromJwt(sessions, q.dslabel, id, req, cred)
			const session = sessions[q.dslabel]?.[id] || sessions[q.dslabel]?.[altId]
			const email = session.email
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
		const embedder = req.query.embedder || req.get('host').split(':')[0]
		for (const dslabelPattern in creds) {
			if (dslabelPattern.startsWith('__')) continue
			const ds = creds[dslabelPattern]
			for (const routePattern in ds) {
				const route = ds[routePattern]
				for (const embedderHostPattern in route) {
					if (!isMatch(embedder, embedderHostPattern)) continue
					const cred = route[embedderHostPattern]
					const query = Object.assign({}, req.query, { dslabel: dslabelPattern })
					const id = getSessionId({ query, headers: req.headers, cookies: req.cookies }, cred)
					const activeSession = sessions[dslabelPattern]?.[id]
					const sessionStart = activeSession?.time || 0
					dsAuth.push({
						dslabel: dslabelPattern,
						route: routePattern,
						type: cred.type || 'basic',
						insession:
							cred.type == 'basic' && req.path.startsWith('/genomes')
								? false
								: (cred.type != 'jwt' || id) && Date.now() - sessionStart < maxSessionAge
					})
				}
			}
		}
		return dsAuth
	}

	// This is used by the server to indicate forbidden routes, with no option for user login,
	// to screen unauthorized server requests from embedders/portal that match a glob pattern.
	// Note that a route that is not forbidden may still require 'jwt' or 'password' access.
	authApi.getForbiddenRoutesForDsEmbedder = function (dslabel, embedder) {
		const forbiddenRoutes = []
		const ds = creds[dslabel] || creds['*']
		if (!ds) return forbiddenRoutes
		for (const k in ds) {
			const cred = ds[k][embedder] || ds[k]['*']
			if (cred?.type == 'forbidden') {
				forbiddenRoutes.push(k)
			}
		}
		return forbiddenRoutes
	}

	authApi.getRequiredCredForDsEmbedder = function (dslabel, embedder) {
		const requiredCred = []
		let alreadyMatched = false
		for (const dslabelPattern in creds) {
			if (!isMatch(dslabel, dslabelPattern)) continue
			for (const routePattern in creds[dslabelPattern]) {
				for (const embedderHostPattern in creds[dslabelPattern][routePattern]) {
					if (!isMatch(embedder, embedderHostPattern)) continue
					const cred = creds[dslabelPattern][routePattern][embedderHostPattern]
					requiredCred.push({
						route: routePattern,
						type: cred.type,
						headerKey: cred.headerKey
					})
				}
			}
		}
		return requiredCred
	}

	authApi.userCanAccess = function (req, ds) {
		const cred = getRequiredCred(req.query, req.path, protectedRoutes.samples)
		if (!cred) return true
		// for 'basic' auth type, always require a login when runpp() is first called
		if (cred.type == 'basic' && req.path.startsWith('/genomes')) return false
		const id = getSessionId(req, cred)
		const altId = mayAddSessionFromJwt(sessions, ds.label, id, req, cred)
		const activeSession = sessions[ds.label]?.[id] || sessions[ds.label]?.[altId]
		const sessionStart = activeSession?.time || 0
		return Date.now() - sessionStart < maxSessionAge
	}

	authApi.getPayloadFromHeaderAuth = function (req, route) {
		if (!req.headers?.authorization) return {}
		const cred = getRequiredCred(req.query, route)
		if (!cred) return {}
		const [type, b64token] = req.headers.authorization.split(' ')
		if (type.toLowerCase() != 'bearer') throw `unsupported authorization type='${type}', allowed: 'Bearer'`
		const token = Buffer.from(b64token, 'base64').toString()
		const payload = jsonwebtoken.verify(token, cred.secret)
		return payload || {}
	}

	authApi.getHealth = async function () {
		const errors = []
		for (const dslabelPattern in creds) {
			if (dslabelPattern.startsWith('#')) continue
			for (const routePattern in creds[dslabelPattern]) {
				if (dslabelPattern.startsWith('#')) continue
				for (const embedderHostPattern in creds[dslabelPattern][routePattern]) {
					if (dslabelPattern.startsWith('#')) continue
					const cred = creds[dslabelPattern][routePattern][embedderHostPattern]
					const keys = [dslabelPattern, routePattern, embedderHostPattern].join(' > ')
					if (cred.processor) {
						if (cred.processor.test) {
							const res = await cred.processor.test(
								cred,
								`http://localhost:${serverconfig.port}${cred.authRoute}`,
								embedderHostPattern
							)
							if (res?.status != 'ok') errors.push(keys)
						}
					} else if (cred.type == 'basic') {
						try {
							const res = await fetch(`http://localhost:${serverconfig.port}${cred.authRoute}`, {
								method: 'POST',
								headers: {
									authorization: `Basic ${btoa(cred.password)}`
								},
								body: JSON.stringify({
									dslabel: dslabelPattern,
									embedder: embedderHostPattern,
									route: cred.route
								})
							}).then(r => r.json())
							if (res?.status != 'ok') errors.push(keys)
						} catch (e) {
							console.log(e)
							errors.push(keys)
						}
					}
				}
			}
		}
		return { errors }
	}
}

function getSessionId(req, cred) {
	// embedder sites may use HTTP 2.0 which requires lowercased header key names
	// using all lowercase is compatible for both http 1 and 2
	return (
		req.cookies?.[`${cred?.cookieId}`] ||
		req.cookies?.[`${req.query.dslabel}SessionId`] ||
		req.headers?.['x-sjppds-sessionid'] ||
		req.query?.['x-sjppds-sessionid']
	)
}

async function getSignedJwt(req, q, id, cred, maxSessionAge, sessionsFile, email = '') {
	if (!cred.secret) return
	try {
		const time = Date.now()
		const iat = Math.floor(time / 1000)
		const payload = {
			dslabel: q.dslabel,
			id,
			iat,
			time,
			ip: req.ip,
			embedder: q.embedder,
			route: cred.route,
			exp: iat + Math.floor(maxSessionAge / 1000),
			email
		}
		if (cred.dsnames) payload.datasets = cred.dsnames.map(d => d.id)
		const jwt = jsonwebtoken.sign(payload, cred.secret)
		await fs.appendFile(
			sessionsFile,
			`${q.dslabel}\t${id}\t${time}\t${email}\t${req.ip}\t${q.embedder}\t${cred.route}\n`
		)
		return jwt
	} catch (e) {
		throw e
	}
}

// in a server farm, where the session state is not shared by all active PP servers,
// the login details that is created by one server can be obtained from the JWT payload
function mayAddSessionFromJwt(sessions, dslabel, id, req, cred) {
	if (!req.headers.authorization || (id && sessions[dslabel]?.[id])) return
	if (!cred.secret)
		throw {
			status: 'error',
			error: `no credentials set up for this embedder='${req.query.embedder}'`,
			code: 403
		}
	const [type, b64token] = req.headers.authorization.split(' ')
	if (type.toLowerCase() != 'bearer') throw `unsupported authorization type='${type}', allowed: 'Bearer'`
	const token = Buffer.from(b64token, 'base64').toString()
	try {
		const payload = jsonwebtoken.verify(token, cred.secret)
		// if (id) {
		// 	if (payload.id != id) {console.log(`---- !!! jwt payload/cookie id mismatch !!! [${payload.id}][${id}] ---`)}
		// 	else console.log('--- !!! id match !!! ---')
		// }
		// the request header custom key or cookie session ID should equal the signed payload.id in the header.authorization,
		// otherwise an expired header.auth jwt may be reused even when a user has already logged out
		if (id && payload.id != id && req.headers?.['x-sjppds-sessionid'] != payload.id) return

		// do not overwrite existing
		if (!sessions[dslabel]) sessions[dslabel] = {}
		//if (sessions[dslabel][payload.id]) throw `session conflict`
		const path = req.path[0] == '/' && !cred.route.startsWith('/') ? req.path.slice(1) : req.path
		if (isMatch(path, cred.route) || path == 'authorizedActions') {
			sessions[dslabel][payload.id] = payload
			return payload.id
		}
	} catch (e) {
		// ok to not add a session from bearer jwt
		return
	}
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
	await fs.appendFile(sessionsFile, `${q.dslabel}\t${id}\t${time}\t${email}\t${ip}\t${q.embedder}\t${cred.route}\n`)
	if (!cred.cookieMode || cred.cookieMode == 'set-cookie') {
		res.header('Set-Cookie', `${cred.cookieId}=${id}; HttpOnly; SameSite=None; Secure`)
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
	const processor = cred.processor || {}

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
	const missingAccess = dsnames.filter(d => !payload.datasets?.includes(d.id)).map(d => d.id)
	if (missingAccess.length) {
		throw { error: 'Missing access', linkKey: missingAccess.join(',') }
	}
	return { iat: payload.iat, email: payload.email, ip: payload.ip }
}

function checkIPaddress(req, ip, cred) {
	// !!! must have a serverconfig.appEnable: ['trust proxy'] entry !!!
	// may loosen the IP address check, if IPv6 or missing
	if (cred.looseIpCheck && (req.ip?.includes(':') || !ip)) return
	if (!ip) throw `Server error: missing ip address in saved session`
	if (req.ip != ip && req.ips?.[0] != ip && req.connection?.remoteAddress != ip)
		throw `Your connection has changed, please refresh your page or sign in again.`
}

export const authApi = {
	maySetAuthRoutes,
	getJwtPayload,
	canDisplaySampleIds: (req, ds) => {
		if (!ds.cohort.termdb.displaySampleIds) return false
		return authApi.userCanAccess(req, ds)
	},
	// these open-acces, default methods may be replaced by maySetAuthRoutes()
	getDsAuth: (req = undefined) => [],
	getForbiddenRoutesForDsEmbedder: (_a, _b) => [],
	userCanAccess: () => true,
	getRequiredCredForDsEmbedder: (dslabel = undefined, embedder = undefined) => undefined,
	getPayloadFromHeaderAuth: () => ({}),
	getHealth: () => undefined
}
