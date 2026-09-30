import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import basicAuth from 'express-basic-auth'
import compression from 'compression'
import { URL } from 'url'
import serverconfig from './serverconfig.js'
import * as validator from './validator.js'
import { authApi } from './auth.js'
import { patternMatches, normalizeReqPath } from './auth/Auth.ts'
import { decode as urlJsonDecode } from '#shared/urljson.js'
import jsonwebtoken from 'jsonwebtoken'
import sjson from 'secure-json-parse'
import fs from 'fs'
import crypto from 'crypto'
import { ReqResCache } from '@sjcrh/augen'
import { abortCtrlBy } from './xfetch.js'
import { mayLog } from './helpers.ts'
import { validateRglst } from './utils.js'
import { mayValidateRequestGeneRefs } from './geneRefValidation.ts'
import { findForbiddenName } from './routes/common.ts'
import { formatElapsedTime } from '#shared'

const basepath = serverconfig.basepath || ''

// NOTE: auth middleware is set in auth.js
export function setAppMiddlewares(app, genomes, doneLoading, routes) {
	app.use(setHeaders)

	if (serverconfig.users) {
		// { user1 : pass1, user2: pass2, ... }
		app.use(basicAuth({ users: serverconfig.users, challenge: true }))
	}

	// Serve the client bundle from this container's own CWD/bin, but ONLY when it carries the marker that
	// proteinpaint-front's init writes after generating the bundle (see front/init.js). Gating on the
	// marker — not merely the dir existing — means launching this server package from a consumer project
	// never publishes an unrelated CWD/bin (e.g. that project's own bin/ scripts) over HTTP, and ensures
	// the bundle is fully generated. Checked here rather than at config load because init creates CWD/bin
	// after serverconfig.js is first loaded. Mounted BEFORE the public static so /bin takes priority;
	// an older image with no such CWD/bin falls through to public/bin below.
	if (serverconfig.binDir && fs.existsSync(path.join(serverconfig.binDir, '.pp-bundle-ready'))) {
		app.use('/bin', express.static(serverconfig.binDir))
	}
	if (serverconfig.publicDir) {
		// NOTE: options = {setHeaders} is not needed here
		// because it's already set at the beginning of this function
		app.use(express.static(serverconfig.publicDir))
	}
	const testDataCacheDir = maySetTestDataCacheDir(doneLoading)

	app.use(
		compression({
			filter: (req, res) => {
				// some routes use stream.pipeline(..., gzip), so need to avoid recompressing here
				if (req.path === '/termdb/matrix') return false
				// Fallback to standard filter function
				return compression.filter(req, res)
			}
		})
	)

	app.use((req, res, next) => {
		if (req.method.toUpperCase() == 'POST') {
			// assume all post requests have json-encoded content
			// TODO: change all client-side fetch(new Request(...)) to use dofetch*() to preset the content-type
			req.headers['content-type'] = 'application/json'
		}

		// detect URL parameter values with matching JSON start-stop encoding characters
		try {
			if (testDataCacheDir) mayWrapResponseSend(testDataCacheDir, req, res)
			urlJsonDecode(req.query)
		} catch (e) {
			console.trace(e)
			res.status(400).send({ error: e.message || e })
			return
		}
		next()
	})

	app.use(cookieParser())
	// read a json body as text and parse it with secure-json-parse, which rejects a __proto__ or
	// constructor.prototype key, since Object.assign(req.query, req.body) below would otherwise
	// replace the prototype of req.query
	app.use(bodyParser.text({ type: 'application/json', limit: '5mb' }))
	app.use((req, res, next) => {
		if (req.headers['content-type'] != 'application/json' || typeof req.body != 'string') return next()
		try {
			// bodyParser.json() sets an empty body to {}, keep that behavior
			req.body = req.body ? sjson.parse(req.body) : {}
		} catch (e) {
			res.status(400).send({ error: `invalid json body: ${e.message}` })
			return
		}
		// preserve the object/array-only contract of bodyParser.json()'s default strict mode: sjson.parse()
		// (like JSON.parse) also accepts a scalar, which would reach Object.assign(req.query, req.body) below
		// as a malformed payload (a string copies its character indexes, other scalars are silently dropped)
		if (req.body === null || typeof req.body != 'object') {
			res.status(400).send({ error: 'invalid json body: must be an object or array' })
			return
		}
		next()
	})
	app.use(bodyParser.text({ limit: '5mb' }))
	app.use(bodyParser.urlencoded({ extended: true }))
	if (testDataCacheDir)
		app.use((req, res, next) => {
			mayWrapResponseSend(testDataCacheDir, req, res)
			next()
		})

	if (serverconfig.jwt) {
		console.log('JWT is activated')
		app.use((req, res, next) => {
			let j = {}
			if (req.body && req.method === 'POST') {
				// a preceding middleware assumes all POST contents are json-encoded and processed by bodyParser()
				j = req.body
			}
			const jwt = j.jwt
				? j.jwt
				: req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
				? req.headers.authorization.split(' ')[1]
				: null
			if (!jwt) return res.send({ error: 'json web token missing' })

			jsonwebtoken.verify(jwt, serverconfig.jwt.secret, (err, decode) => {
				if (err) return res.send({ error: 'Invalid token' })

				// FIXME do not hardcode required attribute, replace with a list
				if (!decode[serverconfig.jwt.permissioncheck]) return res.send({ error: 'Not authorized' })

				next()
			})
		})
	}

	app.use((req, res, next) => {
		if (req.method.toUpperCase() == 'POST' && req.body && req.headers['content-type'] != 'application/json') {
			res.send({ error: `invalid HTTP request.header['content-type'], must be 'application/json'` })
			return
		}
		// a POST /massSession body is the mass app state to save, which may have keys such as an embedder{}
		// object that the auth middleware rejects as a query parameter, so do not merge it into req.query
		const isMassSessionSave =
			req.method.toUpperCase() == 'POST' && normalizeReqPath(req.path) == normalizeReqPath(basepath + '/massSession')
		if (req.headers['content-type'] == 'application/json' && !isMassSessionSave) {
			if (!req.query) req.query = {}
			// TODO: in the future, may have to combine req.query + req.params + req.body
			// if using req.params based on expressjs server route /:paramName interpolation
			Object.assign(req.query, req.body)
		}

		// reject a request whose payload uses a prototype-related name (see forbiddenNames) as an object key
		// or a whole string value, before any code assigns it onto another object or uses it to index one.
		// NOTE: this intentionally scans values everywhere, not just known lookup fields, and accepts the
		// rare false positive of a value that equals one of these reserved names; see findForbiddenName()
		// in routes/common.ts for the full rationale before narrowing it.
		const forbiddenName = findForbiddenName(req.query) || (isMassSessionSave && findForbiddenName(req.body))
		if (forbiddenName) {
			res.status(400).send({ error: `forbidden request payload name at ${forbiddenName}` })
			return
		}

		// log the request before adding additional or protected info
		log(req)

		let ds
		let { genome, dslabel, mds3, dsname, downloadgdc } = req.query
		dslabel = dslabel || mds3 || dsname
		// may need to add more conditions here if there are other req payload params that map to GDC dataset
		if (
			!dslabel &&
			(req.path.startsWith('/gdc') ||
				req.query.downloadgdc ||
				req.query.gdc_id ||
				Object.keys(req.query).find(k => k.startsWith('gdcFile')))
		) {
			genome = 'hg38'
			dslabel = 'GDC'
		}
		if (genome) {
			// Object.hasOwn guards below so that a dslabel or genome that names an inherited property
			// (e.g. 'toString', 'constructor') selects nothing instead of an Object.prototype member;
			// findForbiddenName() above already rejects such values, this is defense in depth
			const altByDs = serverconfig.features?.altGenomeByDslabel
			const altGenome = dslabel && altByDs && Object.hasOwn(altByDs, dslabel) ? altByDs[dslabel] : undefined
			if (altGenome) {
				req.query.genome = altGenome
				genome = altGenome
			}

			// TODO: all server routes handlers that check for valid genome, dslabel
			// should be edited to only check for prefilled req.query.[__protected__??].genome/ds instead,
			// since these simple checks can be centralized in this middleware
			const g = Object.hasOwn(genomes, genome) ? genomes[genome] : undefined
			if (!g) {
				res.send({ error: 'invalid genome' })
				return
			}

			// genome is validated

			if (Object.hasOwn(req.query, 'rglst')) {
				// only validate if present; not every query has rglst param
				// may replace a stringified req.query.rglst with the parsed array
				try {
					validateRglst(req.query, g)
				} catch (e) {
					res.send({ error: e.message || e })
					return
				}
			}

			if (dslabel) {
				ds = g.datasets && Object.hasOwn(g.datasets, dslabel) ? g.datasets[dslabel] : undefined
				// do not check genome-level termdb, not dataset-level termdb
				if (!ds && !(g.termdbs && Object.hasOwn(g.termdbs, dslabel))) {
					const paramName = mds3 ? 'mds3' : dsname ? 'dsname' : 'dslabel'
					res.send({ error: `invalid ${paramName}` })
					return
				}
				// a ds that caches at launch reports its own not-ready state; no dslabel check needed
				const notReady = ds?.init?.notReadyMessage?.()
				if (notReady) {
					res.send({ error: notReady })
					return
				}

				/* reject a gene/isoform name the genome does not know, before any route handler
				can query data with it, locally or against a remote api */
				const geneRefError = mayValidateRequestGeneRefs(req, g, ds)
				if (geneRefError) {
					res.send({ error: geneRefError })
					return
				}
			}
		}

		maySetAbortCtrlAndTrackers(req, res, ds)
		next()
	})

	app.catch = validator.floodCatch
	// augen.setRoutes will use this default if there is no route api.methods[?].request.checker
	validator.setRouteLevelMiddleware({ routes })
}

const hiddenQueryKeys = new Set(['jwt', '__protected__', '__abortSignal'])

function log(req) {
	const j = {}
	for (const k of Object.keys(req.query)) {
		if (!hiddenQueryKeys.has(k)) j[k] = req.query[k]
	}
	// okay to supply a dummy hostname here, since only the pathname needs to be computed
	const pathname = new URL(`http://localhost${req.url}`).pathname
	if (pathname.endsWith('.js.map')) return
	console.log(
		'%s\t%s\t%s\t%s',
		pathname,
		new Date(),
		req.header('x-forwarded-for') || req.connection.remoteAddress,
		JSON.stringify(j).replace(/\\"/g, '"')
	)
}

// returns the parsed URL of the request origin, or undefined if it is missing or malformed
export function getRequestOrigin(req) {
	const origin = req.get('origin')
	// an Origin header must already be a serialized http(s) origin, i.e., scheme://host[:port]
	// with no path, query, or userinfo, otherwise it is rejected instead of being normalized
	if (origin) return parseOrigin(origin, true)
	// a referrer is a full URL, so only this fallback may include a path
	const referrer = req.get('referrer')
	if (referrer) return parseOrigin(referrer, false)
	const host = req.get('host')
	if (host) return parseOrigin(`${req.protocol}://${host}`, true)
}

function parseOrigin(value, mustBeSerializedOrigin) {
	if (typeof value != 'string' || value == 'null') return
	try {
		const url = new URL(value)
		if (url.protocol != 'http:' && url.protocol != 'https:') return
		if (url.username || url.password) return
		if (mustBeSerializedOrigin && url.origin !== value) return
		return url
	} catch (_) {
		return
	}
}

// an allowedEmbedders[] entry must be '*' or exactly equal the origin hostname (or hostname:port);
// a substring match would let an origin like 'https://trusted.org.evil.com' match 'trusted.org'
export function isAllowedEmbedder(origin, host) {
	return host == '*' || (!!origin && (host == origin.hostname || host == origin.host))
}

// a dsCredentials embedder key is matched with the same case-insensitive glob semantics
// as used for auth, so that a key like '*.example.org' also gets credentialed CORS headers
export function isCredEmbedder(origin, pattern) {
	return (
		pattern == '*' || (!!origin && (patternMatches(origin.hostname, pattern) || patternMatches(origin.host, pattern)))
	)
}

function setHeaders(req, res, next) {
	// indicates that caching should be unique to each request origin, i.e., include the origin when computing the cache key
	res.header('Vary', 'Origin')

	// limit the allowed request methods for the PP server
	res.header('Access-Control-Allow-Methods', 'GET, POST,PUT, DELETE, OPTIONS, HEAD')

	const debugtest =
		serverconfig.debugmode || serverconfig.defaultgenome == 'hg38-test' || serverconfig.features?.loosenCORS
	const origin = getRequestOrigin(req)
	// detect if the request origin has a matching entry in serverconfig.dsCredentials
	const credEmbedder = authApi.credEmbedders.find(pattern => isCredEmbedder(origin, pattern))
	// detect if the request origin is allowed as an embedders
	// note that serverconfig.js sets [*] as default serverconfig.allowedEmbedders, if not present
	const matchedHost = serverconfig.allowedEmbedders.find(host => isAllowedEmbedder(origin, host))

	// only set CORS-related headers for a valid request origin that is a credentialed or allowed embedder,
	// otherwise a missing or 'null' origin could be echoed back along with Access-Control-Allow-Credentials
	const isAllowedOrigin = origin && (credEmbedder || matchedHost || debugtest)
	if (isAllowedOrigin) {
		// the origin is only echoed after it has been parsed and matched above
		res.header('Access-Control-Allow-Origin', origin.origin)
		// embedder sites may use HTTP 2.0 which requires lowercased header key names
		// must support mixed casing and all lowercased for compatibility
		res.header(
			'Access-Control-Allow-Headers',
			'Origin, X-Requested-With, Content-Type, Accept, Authorization' +
				', origin, x-requested-with, content-type, accept, authorization' +
				', X-Auth-Token, X-Ds-Access-Token, X-SjPPDs-Sessionid' +
				', x-auth-token, x-ds-access-token, x-sjppds-sessionid'
		)
	}

	if (isAllowedOrigin && (credEmbedder || debugtest)) {
		// allow credentialed embedders to submit authorization header;
		// TODO: require a wildcard dsCredentials embedder key to be a domain-limited glob,
		// such as '*.<domain>.<tld>', instead of a bare '*'
		res.header('Access-Control-Allow-Credentials', true)
	}

	if (debugtest) {
		// may allow a browser to execute js code that samples performance; used by Chrome devtools, maybe puppeteer
		res.header('Document-Policy', 'js-profiling')
	}

	if (req.method == 'GET') {
		// with basic auth, a shared cache must not reuse an authenticated response for other requests
		const cacheControl = getCacheControl(req.path, serverconfig.responseMaxAge, !!serverconfig.users)
		// express.static() does not override an already set cache-control header
		if (cacheControl) res.header('Cache-control', cacheControl)
	}

	if (req.method == 'OPTIONS') {
		// req.headers?.['access-control-request-headers'] is addressed by setting Access-Control-Allow-Headers above
		res.send({ status: 'ok' })
	} else {
		next()
	}
}

/*
	path: a GET request path
	responseMaxAge: optional serverconfig.responseMaxAge, in seconds
	isPrivate: true to only allow a browser cache and not a shared cache to store a static bundle file
*/
export function getCacheControl(path, responseMaxAge, isPrivate = false) {
	const filename = path.split('/').pop()
	// a webpack chunk filename with a content hash, e.g. 123.abcd1234.proteinpaint.js(.map),
	// has a new URL whenever its content changes, see front/webpack.config.js
	if (/^[^.]+\.[0-9a-f]{8}\.proteinpaint\.js(\.map)?$/.test(filename))
		return `${isPrivate ? 'private' : 'public'}, max-age=31536000, immutable`
	// the bundle entry has a stable URL and embeds the hashed chunk filenames,
	// so any cache (browser or proxy) must revalidate it to detect a new deployment
	if (filename == 'proteinpaint.js' || filename == 'version.json') return 'no-cache'
	// immutable response before expiration, client must revalidate after max-age;
	// by convention, any path that has a dot will be treated as
	// a static file and not handled here with cache-control
	if (!path.includes('.')) return `immutable,max-age=${responseMaxAge || 1}`
}

function maySetTestDataCacheDir(doneLoading) {
	if (!serverconfig.features?.cacheTestData || !serverconfig.publicDir || !serverconfig.debugmode) return
	if (!doneLoading.includes('hg38-test/TermdbTest') || !fs.existsSync(`${serverconfig.publicDir}/testrun.html`)) return

	const testDataCacheDir = path.join(serverconfig.binpath, '../public/testrunData')
	if (!fs.existsSync(testDataCacheDir)) fs.mkdirSync(testDataCacheDir)
	console.log(`mayCacheReqRes at ${testDataCacheDir}`)
	return testDataCacheDir
}

const cachedReqIds = new Set()

function mayWrapResponseSend(cachedir, req, res) {
	if (!req.get('referer')?.includes(`/testrun.html`) && !req.get('referer')?.includes(`/puppet.html`)) return
	const query = Object.assign({}, req.query || {}, req.body || {})
	delete query.embedder
	delete query.__protected__
	const cache = new ReqResCache({ path: req.path, query }, { cachedir, mode: 'mkdir' })
	const send = res.send
	res.send = async function (body) {
		// TODO: will need to also set the actual status
		if (!fs.existsSync(cache.loc.file)) await cache.write({ header: { status: 200 }, body }) // no need to await
		send.call(this, body)
	}
}

const routesWithResOnCloseListener = new Set(['/gdc/mafBuild', '/sse'])

// Routes that get a wall-clock elapsed-time abort backstop: if the request runs longer than the
// given ms, abort its q.__abortSignal so any handler wired to that signal stops its in-flight work.
// This ports the former rust `gdcmaf` watchdog (trackByPid/killExpiredProcesses in rust/index.js),
// which SIGTERM-killed a build running >5 min to prevent the leaked/hung process memory usage that
// once crashed a container. The node port of /gdc/mafBuild spawns no process, so the equivalent
// backstop is aborting the download fan-out. Value is config-driven (parity with
// serverconfig.features.gdcMafConcurrency), defaulting to 5 min.
const gdcMafMaxElapsedRaw = Number(serverconfig.features?.gdcMafMaxElapsed)
const gdcMafMaxElapsed = Number.isFinite(gdcMafMaxElapsedRaw) ? gdcMafMaxElapsedRaw : 300000
const routesWithTimeout = new Map([['/gdc/mafBuild', gdcMafMaxElapsed]])

function maySetAbortCtrlAndTrackers(req, res, ds) {
	// assume that cancellations of server computations or external API requests
	// would only be needed when a dataset is specified in the request payload
	if (!ds) return
	if (routesWithResOnCloseListener.has(req.path)) {
		const timeoutMs = routesWithTimeout.get(req.path)
		if (typeof timeoutMs === 'number' && timeoutMs > 0) {
			// These routes manage their own client-disconnect abort (their res.on('close') handler), so we
			// do NOT add the standard disconnect abort here — only the elapsed-time backstop. The handler
			// must attach to q.__abortSignal for this to take effect (see buildMaf in gdc.mafBuild.ts).
			const abortCtrl = new AbortController()
			req.query.__abortSignal = abortCtrl.signal
			const timer = setTimeout(() => {
				mayLog(`(!) ${req.path} exceeded ${formatElapsedTime(timeoutMs)}, aborting`)
				abortCtrl.abort()
			}, timeoutMs)
			timer.unref() // the backstop timer must never keep the process alive on its own
			// clear on either a normal finish or a client-triggered close so it can't fire post-response
			res.once('finish', () => clearTimeout(timer))
			res.once('close', () => clearTimeout(timer))
		}
		// optional trackReqHeaders() should handle a req.query without __abortSignal and filter0 properties
		if (ds.trackReqHeaders) ds.trackReqHeaders(req, res)
		return
	}

	const q = req.query
	const abortCtrl = new AbortController()
	q.__abortSignal = abortCtrl.signal

	// call this after setting q.__abortSignal
	if (ds.trackReqHeaders) ds.trackReqHeaders(req, res)

	abortCtrlBy.signal.set(abortCtrl.signal, abortCtrl)
	if (q.filter0) {
		// in case q.__abortSignal is not passed to the xfetch caller,
		// abortCtrlByFilter0.get(req.query.filter0)?.signal may be used within xfetch()
		// as an alternative means to get the applicable abortSignal
		abortCtrlBy.filter0.set(q.filter0, abortCtrl)
	}

	let isFinished = false
	res.once('finish', () => {
		isFinished = true
	})
	res.once('close', () => {
		if (q.filter0 && typeof q.filter0 === 'object') abortCtrlBy.filter0.delete(q.filter0)
		abortCtrlBy.signal.delete(abortCtrl.signal)
		if (isFinished || res.writableEnded || abortCtrl.signal.aborted) return
		mayLog('(!) client unexpectedly disconnected, will abort stale requests')
		// Trigger an abort() for any code that uses req.query.signal in computations or
		// external requests such as to GDC API. It's also okay for the abort signal to not be used by
		// route handler, data query, or computation code, it may be ignored just like q.__protected__.
		abortCtrl.abort()
	})
}
