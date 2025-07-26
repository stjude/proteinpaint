import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import basicAuth from 'express-basic-auth'
import compression from 'compression'
import url from 'url'
import serverconfig from './serverconfig.js'
import * as validator from './validator.js'
import { authApi } from './auth'
import { decode as urlJsonDecode } from '#shared/urljson.js'
import jsonwebtoken from 'jsonwebtoken'
import fs from 'fs'
import crypto from 'crypto'
import { ReqResCache } from '@sjcrh/augen'

const basepath = serverconfig.basepath || ''

// NOTE: auth middleware is set in auth.js
export function setAppMiddlewares(app, doneLoading) {
	app.use(setHeaders)

	if (serverconfig.users) {
		// { user1 : pass1, user2: pass2, ... }
		app.use(basicAuth({ users: serverconfig.users, challenge: true }))
	}

	if (serverconfig.publicDir) {
		// NOTE: options = {setHeaders} is not needed here
		// because it's already set at the beginning of this function
		app.use(express.static(serverconfig.publicDir))
	}
	const testDataCacheDir = maySetTestDataCacheDir(doneLoading)

	app.use(compression())

	app.use((req, res, next) => {
		if (req.method.toUpperCase() == 'POST') {
			// assume all post requests have json-encoded content
			// TODO: change all client-side fetch(new Request(...)) to use dofetch*() to preset the content-type
			req.headers['content-type'] = 'application/json'
		}

		// detect URL parameter values with matching JSON start-stop encoding characters
		try {
			if (testDataCacheDir) mayWrapResponseSend(testDataCacheDir, req, res)
			const encoding = req.query.encoding
			urlJsonDecode(req.query)
		} catch (e) {
			console.trace(e)
			res.send({ error: e })
			return
		}
		next()
	})

	app.use(cookieParser())
	app.use(bodyParser.json({ limit: '5mb' }))
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
		if (req.headers['content-type'] == 'application/json') {
			if (!req.query) req.query = {}
			// TODO: in the future, may have to combine req.query + req.params + req.body
			// if using req.params based on expressjs server route /:paramName interpolation
			Object.assign(req.query, req.body)
		}

		// log the request before adding protected info
		log(req)

		/*
        !!! put this code after logging the request, so these protected info are not logged !!!
        !! more or less quick fix !!
        in gdc environment, this will pass sessionid from cookie to req.query
        to be added to request header where it's querying gdc api
        by doing this, route code is worry-free and no need to pass "req{}" to gdc purpose-specific code doing the API calls
        these *protected* contents are not used in non-gdc code
        */
		const __protected__ = { ignoredTermIds: [] }
		if (req.query.dslabel) Object.assign(__protected__, authApi.getNonsensitiveInfo(req))
		if (req.cookies?.sessionid) {
			__protected__.sessionid = req.cookies.sessionid
		}
		req.query.__protected__ = Object.freeze(__protected__)
		next()
	})

	app.catch = validator.floodCatch
	app.use(validator.middleware)
}

function log(req) {
	const j = {}
	for (const k in req.query) {
		if (k != 'jwt') j[k] = req.query[k]
	}
	const pathname = url.parse(req.url).pathname
	if (pathname.endsWith('.js.map')) return
	console.log(
		'%s\t%s\t%s\t%s',
		pathname,
		new Date(),
		req.header('x-forwarded-for') || req.connection.remoteAddress,
		JSON.stringify(j).replace(/\\"/g, '"')
	)
}

function setHeaders(req, res, next) {
	// indicates that caching should be unique to each request origin, i.e., include the origin when computing the cache key
	res.header('Vary', 'Origin')

	// limit the allowed request methods for the PP server
	res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD')

	const debugtest = serverconfig.debugmode || serverconfig.defaultgenome == 'hg38-test'
	const origin = req.get('origin') || req.get('referrer') || req.protocol + '://' + (req.get('host') || '*')
	const getMatchingHost = hostname => hostname == '*' || origin.includes(`://${hostname}`)
	// detect if the request origin has a matching entry in serverconfig.dsCredentials
	const credEmbedder = authApi.credEmbedders.find(getMatchingHost)
	// detect if the request origin is allowed as an embedders
	// note that serverconfig.js sets [*] as default serverconfig.allowedEmbedders, if not present
	const matchedHost = serverconfig.allowedEmbedders.find(getMatchingHost)

	if (credEmbedder || matchedHost || debugtest) {
		// only set these CORS-related headers for credentialed or allowed embedders
		const host = matchedHost || credEmbedder
		res.header('Access-Control-Allow-Origin', host === '*' ? origin : `${req.protocol}://${host}`)
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

	if (credEmbedder || debugtest) {
		// allow credentialed embedders to submit authorization header
		res.header('Access-Control-Allow-Credentials', true)
	}

	if (debugtest) {
		// may allow a browser to execute js code that samples performance; used by Chrome devtools, maybe puppeteer
		res.header('Document-Policy', 'js-profiling')
	}

	if (req.method == 'GET' && (!req.path.includes('.') || req.path.endsWith('proteinpaint.js'))) {
		// immutable response before expiration, client must revalidate after max-age;
		// by convention, any path that has a dot will be treated as
		// a static file and not handled here with cache-control
		res.header('Cache-control', `immutable,max-age=${serverconfig.responseMaxAge || 1}`)
	}

	if (req.method == 'OPTIONS') {
		// req.headers?.['access-control-request-headers'] is addressed by setting Access-Control-Allow-Headers above
		res.send({ status: 'ok' })
	} else {
		next()
	}
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
