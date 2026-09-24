import jsonwebtoken from 'jsonwebtoken'
import { getApplicableSecret } from './auth.demoToken.ts'
import mm from 'micromatch'

const { isMatch: mmIsMatch } = mm

// Express routes requests case-insensitively and ignores a trailing slash (non-strict routing),
// so auth path checks must do the same, otherwise a request to `/TERMDB/MATRIX` or `/termdb/matrix/`
// would not match a protected route pattern but would still be handled by the protected route
export function normalizeReqPath(path: string) {
	if (typeof path != 'string') return ''
	const p = path.toLowerCase().replace(/\/+$/, '')
	return p || (path.startsWith('/') ? '/' : '')
}

// The auth middleware is not mounted under serverconfig.basepath, so req.path includes the basepath,
// but the protected route checks in getRequiredCred() and dsCredentials route patterns do not.
// Returns the normalized request path with a matching basepath prefix removed.
export function stripBasepath(path: string, basepath = '') {
	const p = normalizeReqPath(path)
	const prefix = normalizeReqPath(basepath)
	if (!prefix || prefix == '/') return p
	if (p == prefix) return '/'
	// collapse any extra leading slashes, e.g. from a basepath with a trailing slash
	if (p.startsWith(prefix + '/')) return p.slice(prefix.length).replace(/^\/+/, '/')
	return p
}

function isMatch(path: string, pattern: string) {
	return mmIsMatch(path, pattern, { nocase: true })
}

// returns true if a client-supplied value matches a single dsCredentials key: the '*' wildcard
// or an identical key always matches, any other key is tried as a glob pattern. Note that a glob '*'
// alone does not match values with a '/', such as embedder='a/b', so the wildcard must be checked
// explicitly to avoid treating a protected dataset as open access.
//
// This only decides whether one key matches. When more than one key matches, see getMatchedEntry()
// and Auth.getMatchedDsEntries() for which key takes precedence.
export function patternMatches(value, pattern) {
	if (pattern === '*' || value === pattern) return true
	if (typeof value != 'string' || !value || !pattern) return false
	return isMatch(value, pattern)
}

// client-supplied query parameters that are used to resolve dsCredentials entries. A non-string value,
// e.g. an array from `embedder[]=...`, would not match an exact key and could fall through to no
// credential, treating a protected dataset as open access, so these must be strings when present
export const authQueryParams = ['dslabel', 'embedder', 'genome', 'route']

// returns the name of the first auth query parameter that is present but is not a string
export function getNonStringAuthParam(q) {
	return authQueryParams.find(key => q?.[key] !== undefined && typeof q[key] != 'string')
}

// fail closed: throw instead of resolving a non-string value as matching no credential
export function assertStringOrUndefined(value, name) {
	if (value !== undefined && typeof value != 'string')
		throw Object.assign(new Error(`invalid ${name}: must be a string`), { status: 400 })
}

// return the value for the key in obj that best matches a client-supplied value, from the most to the
// least specific key: an exact key first, then a glob pattern key, then the '*' wildcard. A glob key
// takes precedence over '*', so that a config like { '*': forbidden, '*.example.org': jwt } requires
// a login for the matching embedders and forbids all others. The same order is used for dslabel keys
// in Auth.getMatchedDsEntries().
export function getMatchedEntry(obj, value) {
	assertStringOrUndefined(value, 'embedder')
	if (!obj) return
	if (typeof value == 'string' && Object.hasOwn(obj, value)) return obj[value]
	for (const pattern in obj) {
		if (pattern != '*' && patternMatches(value, pattern)) return obj[pattern]
	}
	return obj['*']
}

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
	} = Object.create(null)
	sessionTracking: '' | 'jwt-only' = ''
	// the basepath that auth and data routes are registered under, see stripBasepath(),
	// set by AuthApi.maySetAuthRoutes() so that route registration, the middleware forced-open check,
	// and credential matching all use the same basepath value
	basepath: string = ''

	// TODO: should create a checker function for each route group that may be protected
	protectedRoutes = {
		// below is used in getRequiredCred as the default protected routes
		termdb: ['/termdb/matrix'],
		// below is used in AuthApi.canDisplaySampleIds()
		samples: [
			'singleSampleData',
			'getAllSamples',
			'convertSampleId',
			'getSamplesByName',
			'scatter',
			'/termdb/sampleScatter',
			'/termdb/matrix'
		],
		minSampleSize: [
			'/termdb/barsql',
			'/termdb/cuminc',
			'/termdb/survival',
			'/termdb/regression',
			'scatter',
			'/termdb/sampleScatter',
			'/termdb/matrix'
		]
	}

	constructor(creds, app, genomes, serverconfig) {
		this.app = app
		this.creds = creds
		this.genomes = genomes
		if (serverconfig.port) this.port = serverconfig.port
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
		// dslabel keys may be exact, glob patterns, or the '*' wildcard, in that order of precedence
		const dsEntries = this.getMatchedDsEntries(q.dslabel)
		// no credentials for this dslabel, is open access
		if (!dsEntries.length) return
		// also normalizes a non-string path to ''
		path = stripBasepath(path, this.basepath)
		// faster matching, based on known protected routes
		if (path == '/jwt-status' || path == '/demotoken') {
			return this.getRouteCred(q.dslabel, [q.route, 'termdb', '/**'], q.embedder)
		} else if (path == '/dslogin') {
			return this.getRouteCred(q.dslabel, [q.route, '/**'], q.embedder)
		} else if (path.startsWith('/termdb')) {
			const cred = this.getRouteCred(q.dslabel, ['termdb'], q.embedder)
			if (cred) {
				if (cred.protectedRoutes?.find(pattern => isMatch(path, pattern))) return cred
				const protRoutes = _protectedRoutes || this.protectedRoutes.termdb
				// q.for is client-supplied and may be a non-string, e.g. an array from `for[]=...`
				// query params, so check every value instead of an exact includes() match on q.for
				const forValues = q.for === undefined ? [] : Array.isArray(q.for) ? q.for : [q.for]
				if (forValues.some(f => protRoutes.includes(String(f)))) return cred
				if (protRoutes.find(pattern => isMatch(path, pattern))) return cred
			}
		} else if (path.startsWith('/burden')) {
			const cred = this.getRouteCred(q.dslabel, ['burden'], q.embedder)
			if (cred) return cred
		}

		for (const ds of dsEntries) {
			for (const routeName in ds) {
				const routePattern = ds[routeName].routePattern || routeName
				if (!isMatch(path, routePattern)) continue
				const cred = getMatchedEntry(ds[routeName], q.embedder)
				if (cred) return cred
			}
		}
	}

	// returns the dsCredentials entries that apply to a client-supplied dslabel, ordered by precedence:
	// an exact key, then glob pattern keys (e.g. 'realD*'), then the '*' wildcard;
	// keys that start with '#' (comment) or '__' (not a dslabel) are not used as glob patterns
	getMatchedDsEntries(dslabel) {
		assertStringOrUndefined(dslabel, 'dslabel')
		const creds = this.creds
		const entries: any[] = []
		if (typeof dslabel == 'string' && Object.hasOwn(creds, dslabel)) entries.push(creds[dslabel])
		for (const pattern in creds) {
			if (pattern == dslabel || pattern == '*' || pattern.startsWith('#') || pattern.startsWith('__')) continue
			if (patternMatches(dslabel, pattern)) entries.push(creds[pattern])
		}
		if (creds['*']) entries.push(creds['*'])
		return entries
	}

	// returns the route keys, such as 'termdb', 'burden', or '/**', that are configured for a dslabel
	// across all of its matched dsCredentials entries, in order of precedence
	getMatchedRouteKeys(dslabel) {
		const routeKeys = new Set<string>()
		for (const ds of this.getMatchedDsEntries(dslabel)) {
			for (const routeKey in ds) routeKeys.add(routeKey)
		}
		return [...routeKeys]
	}

	// This is the shared resolver for a credential that applies to a concrete dslabel and embedder,
	// to be used for credential discovery, login, middleware, and session checks.
	//
	// routeKeys[]: the route keys to try in order, e.g. ['termdb'] or [q.route, 'termdb', '/**']
	//
	// For each route key, the matched dslabel entries are checked in order of precedence
	// (exact, glob, '*'), and the first entry with a matching embedder key (exact, glob, '*') wins.
	// A lower-precedence entry is still checked when a higher-precedence entry does not have
	// that route or embedder, so that a configured credential is not mistaken for open access.
	getRouteCred(dslabel, routeKeys: any[], embedder) {
		const dsEntries = this.getMatchedDsEntries(dslabel)
		for (const routeKey of routeKeys) {
			// a client-supplied route key, such as q.route, must be a string
			if (typeof routeKey != 'string' || !routeKey) continue
			for (const ds of dsEntries) {
				if (!Object.hasOwn(ds, routeKey)) continue
				const cred = getMatchedEntry(ds[routeKey], embedder)
				if (cred) return cred
			}
		}
	}

	// returns the termdb or all-routes credential that applies to the requested dslabel and embedder,
	// regardless of the request path or q.for, or falsy if the dataset's termdb data is open access
	getTermdbCred(q) {
		if (!q.dslabel) return
		// also check the all-routes entry: validateDsCredentials() rewrites a '*' route key
		// to '/**', and the raw '*' key may still be present in unvalidated credentials
		return this.getRouteCred(q.dslabel, ['termdb', '/**', '*'], q.embedder)
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
			return {
				iat: payload.iat,
				email: payload.email,
				ip: payload.ip,
				clientAuthResult: payload.clientAuthResult
			}

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
			if (!sessions[q.dslabel]) sessions[q.dslabel] = Object.create(null)
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
			const reqPath = stripBasepath(req.path, this.basepath)
			const path = reqPath[0] == '/' && !cred.route.startsWith('/') ? reqPath.slice(1) : reqPath
			// signed payload route must match the requested data route
			if (
				cred.route === '*' ||
				isMatch(path, cred.route) ||
				path == 'authorizedactions' ||
				path.startsWith(cred.route.toLowerCase() + '/')
			) {
				if (!sessions[dslabel][id])
					sessions[dslabel][id] = {
						...payload,
						dslabel,
						embedder,
						route: cred.route
					}
				return id
			}
		} catch (e) {
			console.log(e)
			// ok to not add a session from bearer jwt
			return
		}
	}
}
