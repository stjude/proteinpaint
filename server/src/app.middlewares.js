import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import basicAuth from 'express-basic-auth'
import compression from 'compression'
import url from 'url'
import serverconfig from './serverconfig.js'
import { authApi } from './auth.js'
import * as validator from './validator.js'
import { decode as urlJsonDecode } from '#shared/urljson.ts'

const basepath = serverconfig.basepath || ''

export function setAppMiddlewares(app) {
	if (serverconfig.users) {
		// { user1 : pass1, user2: pass2, ... }
		app.use(basicAuth({ users: serverconfig.users, challenge: true }))
	}

	if (!serverconfig.backend_only) {
		const staticDir = express.static(path.join(process.cwd(), './public'), { setHeaders })
		app.use(staticDir)
	}

	app.use(compression())

	app.use((req, res, next) => {
		if (req.method.toUpperCase() == 'POST') {
			// assume all post requests have json-encoded content
			// TODO: change all client-side fetch(new Request(...)) to use dofetch*() to preset the content-type
			req.headers['content-type'] = 'application/json'
		}

		// detect URL parameter values with matching JSON start-stop encoding characters
		try {
			const encoding = req.query.encoding
			urlJsonDecode(req.query)
		} catch (e) {
			res.send({ error: e })
			return
		}
		next()
	})

	app.use(cookieParser())
	app.use(bodyParser.json({ limit: '5mb' }))
	app.use(bodyParser.text({ limit: '5mb' }))
	app.use(bodyParser.urlencoded({ extended: true }))

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
		req.query.__protected__ = {}
		if (req.cookies?.sessionid) {
			req.query.__protected__.sessionid = req.cookies.sessionid
		}
		Object.freeze(req.query.__protected__)

		setHeaders(res)
		res.header(
			'Access-Control-Allow-Origin',
			req.get('origin') || req.get('referrer') || req.protocol + '://' + req.get('host').split(':')[0] || '*'
		)
		res.header('Access-Control-Allow-Credentials', true)

		if (req.method == 'GET' && (!req.path.includes('.') || req.path.endsWith('proteinpaint.js'))) {
			// immutable response before expiration, client must revalidate after max-age;
			// by convention, any path that has a dot will be treated as
			// a static file and not handled here with cache-control
			res.header('Cache-control', `immutable,max-age=${serverconfig.responseMaxAge || 1}`)
		}
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
	console.log(
		'%s\t%s\t%s\t%s',
		url.parse(req.url).pathname,
		new Date(),
		req.header('x-forwarded-for') || req.connection.remoteAddress,
		JSON.stringify(j).replace(/\\"/g, '"')
	)
}

function setHeaders(res) {
	res.header('Vary', 'Origin')
	res.header('Access-Control-Allow-Origin', '*')
	res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD')
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

function isNumeric(d) {
	return !isNaN(parseFloat(d)) && isFinite(d) && d !== ''
}
