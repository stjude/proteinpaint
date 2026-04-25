import jsonwebtoken from 'jsonwebtoken'
import { getApplicableSecret } from './auth.demoToken.ts'
import mm from 'micromatch'

const { isMatch } = mm

// This is the "inner" private auth that's wrapped by AuthApi.
// It hides and protect implementation details from being accidentally
// viewed or mutated by consumer code.
export class Auth {
	// the required security checks for each applicable dslabel, to be processed from serverconfig.dsCredentials
	creds: any
	// express app
	app: any
	port: number = 3000
	genomes: any
	maxSessionAge: number = 1000 * 3600 * 16
	authHealth: Map<string, any> = new Map()
	sessions: {
		[dslabel: string]: {
			[sessionId: string]: any
		}
	} = {}
	sessionTracking: '' | 'jwt-only' = ''

	// TODO: should create a checker function for each route group that may be protected
	protectedRoutes = {
		termdb: ['matrix'],
		samples: ['singleSampleData', 'getAllSamples', 'scatter', 'convertSampleId', 'getSamplesByName'],
		minSampleSize: ['/termdb/barsql', 'matrix', 'cuminc', 'survival', 'regression', 'scatter']
	}

	constructor(creds, app, genomes, serverconfig) {
		this.app = app
		this.creds = creds
		this.genomes = genomes
		const { sessionTracking, maxSessionAge } = serverconfig.features || {}
		if (sessionTracking) this.sessionTracking = sessionTracking
		if (maxSessionAge) this.maxSessionAge = maxSessionAge
	}

	// runs on every request as part of middleware to inspect request
	//
	// returns
	// - a cred object containing details
	// - falsy if a data route is not protected
	//
	getRequiredCred(q, path, _protectedRoutes?: string[]) {
		if (!q.dslabel) return
		const creds = this.creds
		// faster exact matching, based on known protected routes
		// if no creds[dslabel], match to wildcard dslabel if specified
		const ds0 = creds[q.dslabel] || creds['*']
		if (ds0) {
			if (path == '/jwt-status' || path == '/demoToken') {
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
				const protRoutes = _protectedRoutes || this.protectedRoutes.termdb
				if (protRoutes.includes(q.for) || protRoutes.find(pattern => isMatch(path, pattern))) return cred
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

	/**
		Arguments
		q: req.query
		headers: req.headers
		cred: object returned by getRequiredCred
		session: (optional) a tracked session object

		NOTE: Embedder/login jwt is expected to not include a dslabel property,
		while a session jwt is expected to have a dslabel property.
	*/
	getJwtPayload(q, headers, cred, session = null) {
		if (!cred) return
		if (!q.embedder) throw `missing q.embedder`
		// const embedder = cred.embedders[q.embedder]
		// if (!embedder) throw `unknown q.embedder='${q.embedder}'`
		if (!cred.secret)
			throw {
				status: 'error',
				error: `no credentials set up for this embedder`,
				code: 403
			}
		const time = Math.floor(Date.now() / 1000)

		const rawToken = headers[cred.headerKey]
		if (!rawToken) throw `missing header['${cred.headerKey}']`

		const { secret, processor } = getApplicableSecret(headers, cred, rawToken)
		// use handleToken() if available for an embedder, for example to decrypt a fully encrypted jwt
		const token =
			// the embedder may supply a processor function
			secret === cred.secret && processor.handleToken ? processor.handleToken(rawToken) : rawToken
		let payload
		try {
			// this verification will throw if the token is invalid in any way
			payload = jsonwebtoken.verify(token, secret) // change the secret with a suffix or to some other string to trigger and test the error below
		} catch (e: any) {
			// may include info on whether a demoToken secret was used, to help with embedder troubleshooting
			if (typeof e == 'object' && cred.demoToken) e.usedDemoTokenSecret = secret === cred.demoToken.secret
			throw e
		}

		// if there is a session, handle the expiration outside of this function
		if (session)
			return { iat: payload.iat, email: payload.email, ip: payload.ip, clientAuthResult: payload.clientAuthResult }

		// the embedder may use a post-processor function to
		// optionally transform, translate, reformat the payload,
		// but this only applies to non-session jwt that was issued
		// directly from getDatasetAccessToken() on the client-side
		// and doesn't have a dslabel property
		if (processor.handlePayload) {
			try {
				processor.handlePayload({ ...cred, secret }, payload, time)
			} catch (e: any) {
				const errorMessage = typeof e == 'object' && e?.message ? e.message : String(e)
				console.log(`JWT payload processing failed: ${errorMessage}`)
				if (e.reason == 'bad decrypt') throw `Please login again to access this feature. (${e.reason})`
				throw e
			}
		}

		if (time > payload.exp) throw `Please login again to access this feature. (expired token)`

		const dsnames = cred.dsnames || [q.dslabel]
		// some dslabels do not specify datasets[] array in the serverconfig.dsCredentials[dslabel],
		// and in that case the jwt payload access is applied to the full dataset cohort instead of a subset/subcohort
		const missingAccess =
			payload.datasets?.length && dsnames.filter(d => !payload.datasets?.includes(d.id)).map(d => d.id)
		if (missingAccess?.length) {
			throw { error: 'Missing access', linkKey: missingAccess.join(',') }
		}
		return {
			iat: payload.iat,
			email: payload.email,
			ip: payload.ip,
			clientAuthResult: payload.clientAuthResult,
			rawToken
		}
	}

	// cred.ipCheck: undefined | 'none' | 'loose'
	// undefined (default) means strict check, by default
	// NOTE: legacy cred.looseIpCheck will be converted to `cred.ipCheck: loose`
	checkIPaddress(req, ip, cred) {
		// !!! must have a serverconfig.appEnable: ['trust proxy'] entry !!!
		// may loosen the IP address check, if IPv6 or missing
		if (cred.ipCheck == 'none') return
		if (cred.ipCheck == 'loose' && (req.ip?.includes(':') || !ip)) return
		if (!ip) throw `Server error: missing ip address in saved session`
		if (req.ip != ip && req.ips?.[0] != ip && req.connection?.remoteAddress != ip)
			throw `Your connection has changed, please refresh your page or sign in again.`
	}

	getSessionId(req, cred) {
		// embedder sites may use HTTP 2.0 which requires lowercased header key names
		// using all lowercase is compatible for both http 1 and 2
		if (this.sessions && req.headers?.authorization) {
			const id = this.mayAddSessionFromJwt(this.sessions, req, cred)
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

	getSessionIdFromJwt(jwt) {
		// the last segment of the dot-separated jwt string is the signature,
		// this hash can be used as a unique ID
		return jwt.slice(-20)
	}

	// proteinpaint-issued JWT
	getSignedJwt(req, res, q, cred, clientAuthResult, maxSessionAge, email = '', sessions) {
		if (!cred.secret) return
		try {
			const time = Date.now()
			const iat = Math.floor(time / 1000)
			const payload: any = {
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
			const { secret } = getApplicableSecret(req.headers, cred, payload)
			const jwt = jsonwebtoken.sign(payload, secret)
			const id = this.getSessionIdFromJwt(jwt)
			//const ip = req.ip // may use req.ips?
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
			console.log('getSignedJwt() error')
			throw e
		}
	}

	// in a server farm, where the session state is not shared by all active PP servers,
	// the login details that is created by one server can be obtained from the JWT payload
	mayAddSessionFromJwt(sessions, req, cred) {
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
		const id = this.getSessionIdFromJwt(token)
		try {
			const { secret } = getApplicableSecret(req.headers, cred, token)
			const payload = sessions[dslabel]?.[id] || jsonwebtoken.verify(token, secret)
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
}
