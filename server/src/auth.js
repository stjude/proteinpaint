import { promises as fs } from 'fs'
import path from 'path'
import jsonwebtoken from 'jsonwebtoken'
import { sleep } from './utils.js'
import mm from 'micromatch'

const { isMatch } = mm

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
		// if (dslabel[0] == '#') continue
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
	const actionsFile = path.join(serverconfig.cachedir, 'authorizedActions')
	// the required security checks for each applicable dslabel, to be processed from serverconfig.dsCredentials
	const creds = serverconfig.dsCredentials || {}
	// !!! do not expose the loaded dsCredentials to other code that imports serverconfig.json !!!
	delete serverconfig.dsCredentials

	const maxSessionAge = serverconfig.maxSessionAge || 1000 * 3600 * 16
	// !!! do not use or save sessions data from/to a file !!!
	// always start with an empty sessions tracking object,
	// will fill-in as requests with auth or x-ds-*-token are received
	let sessions = {}

	// no need to setup additional middlewares and routes
	// if there are no protected datasets
	if (!creds || !Object.keys(creds).length) {
		// no checks for ds, is open access
		// custom auth for testing
		if (serverconfig.debugmode && !app.doNotFreezeAuth) Object.freeze(authApi)
		return
	}
	try {
		validateDsCredentials(creds, serverconfig)
	} catch (e) {
		throw e
	}

	// runs on every request as part of middleware to inspect request
	//
	// returns
	// - a cred object containing details
	// - falsy if a data route is not protected
	//
	function getRequiredCred(q, path, _protectedRoutes) {
		if (!q.dslabel) return
		// faster exact matching, based on known protected routes
		// if no creds[dslabel], match to wildcard dslabel if specified
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
				const cred = route[q.embedder] || route['*']
				if (!cred) return
				if (cred.protectedRoutes?.find(pattern => isMatch(path, pattern))) return cred
				const protRoutes = _protectedRoutes || protectedRoutes.termdb
				if (protRoutes.includes(q.for)) return cred
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
		if (sessionTracking == 'jwt-only') {
			console.log('!!! --- CLEARING ALL SESSION DATA TO simulate stateless service --- !!!')
			sessions = {}
		}

		try {
			const id = getSessionId(req, cred, sessions)
			const session = id && sessions[q.dslabel]?.[id]
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
			code = 401 // in case of jwt processing error
			const jwt = await getSignedJwt(req, res, q, cred, {}, maxSessionAge, '', sessions)
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
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/jwt-status', async (req, res) => {
		let code = 401 // assume unauthorized by default
		const q = req.query
		const cred = getRequiredCred(q, req.path)
		try {
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			if (cred.authRoute != '/jwt-status') {
				code = 400
				throw `Incorrect authorization route, use ${cred.authRoute}'`
			}
			const result = getJwtPayload(q, req.headers, cred)
			const { email, ip, clientAuthResult } = getJwtPayload(q, req.headers, cred)

			checkIPaddress(req, ip, cred)
			code = 401 // in case of jwt processing error
			const jwt = await getSignedJwt(req, res, q, cred, clientAuthResult, maxSessionAge, email, sessions)
			// difficult to setup CORS cookie, will deprecate support
			res.send({ status: 'ok', jwt, route: cred.route, clientAuthResult })
		} catch (e) {
			console.log(e)
			res.status(code)
			res.header('Set-Cookie', `${cred.cookieId}=; HttpOnly; SameSite=None; Secure; Max-Age=0`)
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
			const session = sessions[q.dslabel]?.[id]
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
		will return a list of all dslabels that require credentials
	*/
	authApi.getDsAuth = function (req) {
		const dsAuth = []
		const embedder = req.query.embedder || req.get('host')?.split(':')[0] // do not include port number
		for (const [dslabelPattern, ds] of Object.entries(creds)) {
			if (dslabelPattern.startsWith('__')) continue
			for (const [routePattern, route] of Object.entries(ds)) {
				for (const [embedderHostPattern, cred] of Object.entries(route)) {
					if (embedderHostPattern != '*' && !isMatch(embedder, embedderHostPattern)) continue
					const query = Object.assign({}, req.query, { dslabel: dslabelPattern })
					const id = getSessionId({ query, headers: req.headers, cookies: req.cookies }, cred, sessions)
					const activeSession = sessions[dslabelPattern]?.[id]
					const sessionStart = activeSession?.time || 0
					// support a dataset-specific override to maxSessionAge
					const maxAge = cred.maxSessionAge || maxSessionAge
					const currTime = Date.now()
					const insession =
						// Previously, all requests to `/genomes` is assumed to originate from a "landing page"
						// that should trigger a sign-in. This assumption causes unnecessary duplicate logins
						// when the landing page opens links to protected pages that also request `/genomes` data.
						/* cred.type == 'basic' && req.path.startsWith('/genomes')
						? false
						: */ (cred.type != 'jwt' || id) && currTime - sessionStart < maxAge

					// if session is valid, extend the session expiration by resetting the start time
					if (insession) activeSession.time = currTime

					dsAuth.push({
						dslabel: dslabelPattern,
						route: routePattern,
						type: cred.type || 'basic',
						headerKey: cred.headerKey,
						insession
					})
				}
			}
		}

		return dsAuth
	}

	/* return non sensitive user auth info to assist backend process e.g. getSupportChartTypes
	forbiddenRoutes: 
		This is used by the server to indicate forbidden routes, with no option for user login,
		to screen unauthorized server requests from embedders/portal that match a glob pattern.
		Note that a route that is not forbidden may still require 'jwt' or 'password' access.
	clientAuthResult:
		ds-specific jwt payload
	*/
	authApi.getNonsensitiveInfo = function (req) {
		if (!req.query.dslabel) throw 'req.query.dslabel missing'
		if (!req.query.embedder) throw 'req.query.embedder missing'

		const forbiddenRoutes = []
		const ds = creds[req.query.dslabel] || creds['*']
		let cred
		if (!ds) {
			// no checks for this ds, is open access
			return { forbiddenRoutes, clientAuthResult: {} }
		} else {
			// has checks
			for (const k in ds) {
				cred = ds[k][req.query.embedder] || ds[k]['*']
				if (cred?.type == 'forbidden') {
					forbiddenRoutes.push(k)
				}
			}
		}
		const id = getSessionId(req, cred, sessions)
		const activeSession = sessions[req.query.dslabel]?.[id]
		return { forbiddenRoutes, clientAuthResult: activeSession?.clientAuthResult }
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
		return requiredCred.length ? requiredCred : undefined
	}

	authApi.userCanAccess = function (req, ds) {
		const cred = getRequiredCred(req.query, req.path, protectedRoutes.samples)
		if (!cred) return true
		// !!! DEPRECATED: for 'basic' auth type, always require a login when runpp() is first called !!!
		// this causes unnecessary additional logins when links are opened from a 'landing page'
		// if (cred.type == 'basic' && req.path.startsWith('/genomes')) return false
		const id = getSessionId(req, cred, sessions)
		const activeSession = sessions[ds.label]?.[id]
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

	// custom auth for testing
	if (serverconfig.debugmode && !app.doNotFreezeAuth) Object.freeze(authApi)
}

function getSessionId(req, cred, sessions) {
	// embedder sites may use HTTP 2.0 which requires lowercased header key names
	// using all lowercase is compatible for both http 1 and 2
	if (sessions && req.headers?.authorization) {
		const id = mayAddSessionFromJwt(sessions, req, cred)
		if (id) return id
	}

	// TODO: should deprecate session tracking by cookie and custom http header field,
	// and rely exclusively on jwt from headers.authorization
	return (
		req.cookies?.[`${cred?.cookieId}`] ||
		req.cookies?.[`${req.query.dslabel}SessionId`] ||
		req.cookies?.[`x-ds-access-token`] ||
		req.headers?.['x-sjppds-sessionid'] ||
		req.query?.['x-sjppds-sessionid']
	)
}

function getSessionIdFromJwt(jwt) {
	// the last segment of the dot-separated jwt string is the signature,
	// this hash can be used as a unique ID
	return jwt.slice(-20)
}

// proteinpaint-issued JWT
async function getSignedJwt(req, res, q, cred, clientAuthResult, maxSessionAge, email = '', sessions) {
	if (!cred.secret) return
	try {
		const time = Date.now()
		const iat = Math.floor(time / 1000)
		const payload = {
			dslabel: q.dslabel,
			iat,
			time,
			ip: req.ip,
			// embedder pattern from dsCredential entry
			embedder: q.embedder,
			// route pattern from dsCredential entry
			route: cred.route,
			exp: iat + Math.floor(maxSessionAge / 1000),
			clientAuthResult,
			email
		}
		if (cred.dsnames) payload.datasets = cred.dsnames.map(d => d.id)
		const jwt = jsonwebtoken.sign(payload, cred.secret)
		const id = getSessionIdFromJwt(jwt)
		const ip = req.ip // may use req.ips?
		if (!sessions[q.dslabel]) sessions[q.dslabel] = {}
		sessions[q.dslabel][id] = payload
		if (!cred.cookieMode || cred.cookieMode == 'set-cookie') {
			// For basic/password login that protects all routes (including /genomes),
			// must use session cookie, since it's not practical for the client dofetch code
			// to always add a header.authorization or other custom http header field to
			// every request. Also, different cookie IDs are submitted all at once, so the
			// auth middleware or active server route handler can pick which cookie/header to use.
			// In contrast, credentials typically require selective custom header/bearer token data
			// for the current requested data route that's being served, and it may not always
			// be clear which specific session/token data to include in the client request.
			//
			// IMPORTANT: Session cookies only work when the proteinpaint server and client
			// bundle are cohosted within the same embedder host/domain, otherwise CORS security
			// will typically strip the 3rd-party PP cookie. TODO: Fix this if password-login
			// is required for external embedders, otherwise just use jwt which already works.
			//
			res.header('Set-Cookie', `${cred.cookieId}=${id}; HttpOnly; SameSite=None; Secure`)
		}
		return jwt
	} catch (e) {
		throw e
	}
}

// in a server farm, where the session state is not shared by all active PP servers,
// the login details that is created by one server can be obtained from the JWT payload
function mayAddSessionFromJwt(sessions, req, cred) {
	const { dslabel, embedder } = req.query
	if (!req.headers?.authorization) return
	if (!cred.secret)
		throw {
			status: 'error',
			error: `no credentials set up for this embedder='${req.query.embedder}'`,
			code: 403
		}
	const [type, b64token] = req.headers.authorization.split(' ')
	if (type.toLowerCase() != 'bearer') throw `unsupported authorization type='${type}', allowed: 'Bearer'`
	const token = Buffer.from(b64token, 'base64').toString()
	const id = getSessionIdFromJwt(token)
	try {
		const payload = sessions[dslabel]?.[id] || jsonwebtoken.verify(token, cred.secret)
		// signed payload dataset must match the requested dataset
		if (payload.dslabel) {
			if (payload.dslabel != dslabel) return
		} else if (payload.datasets) {
			if (!payload.datasets.includes(dslabel)) return
		} else {
			throw `jwt payload missing datasets[] and dslabel, must have one`
		}
		// do not overwrite existing tracking object for dslabel
		if (!sessions[dslabel]) sessions[dslabel] = {}
		const path = req.path[0] == '/' && !cred.route.startsWith('/') ? req.path.slice(1) : req.path
		// signed payload route must match the requested data route
		if (
			cred.route === '*' ||
			isMatch(path, cred.route) ||
			path == 'authorizedActions' ||
			path.startsWith(cred.route + '/')
		) {
			if (!sessions[dslabel][id]) sessions[dslabel][id] = { ...payload, dslabel, embedder, route: cred.route }
			return id
		}
	} catch (e) {
		console.log(e)
		// ok to not add a session from bearer jwt
		return
	}
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
	if (session)
		return { iat: payload.iat, email: payload.email, ip: payload.ip, clientAuthResult: payload.clientAuthResult }

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
	return { iat: payload.iat, email: payload.email, ip: payload.ip, clientAuthResult: payload.clientAuthResult }
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
	getNonsensitiveInfo: _ => {
		forbiddenRoutes: []
	},
	userCanAccess: () => true,
	getRequiredCredForDsEmbedder: (dslabel = undefined, embedder = undefined) => undefined,
	getPayloadFromHeaderAuth: () => ({}),
	getHealth: () => undefined
}
