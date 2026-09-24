import tape from 'tape'
import jsonwebtoken from 'jsonwebtoken'
import { Auth, getMatchedEntry, getNonStringAuthParam, normalizeReqPath, stripBasepath } from '#src/auth/Auth.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'auth-class-test-secret' // pragma: allowlist secret
const time = Math.floor(Date.now() / 1000)
const dslabel = 'testDs'
const embedder = 'localhost'

function makeCred(overrides: any = {}) {
	return {
		type: 'jwt',
		secret,
		headerKey: 'x-ds-access-token',
		authRoute: '/jwt-status',
		route: 'termdb',
		cookieId: 'x-ds-access-token',
		dslabel,
		...overrides
	}
}

function makeAuth(credOverrides: any = {}, serverconfig: any = {}) {
	const creds = {
		[dslabel]: {
			termdb: {
				[embedder]: makeCred(credOverrides)
			}
		}
	}
	const app = {}
	const genomes = {}
	return new Auth(creds, app, genomes, { port: 3000, ...serverconfig })
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/Auth unit -***-')
	test.end()
})

tape('Auth constructor: sets default properties', function (test) {
	test.timeoutAfter(500)
	test.plan(5)

	const auth = makeAuth()
	test.equal(auth.port, 3000, 'should set port from serverconfig')
	test.equal(auth.maxSessionAge, 1000 * 3600 * 16, 'should set default maxSessionAge')
	test.equal(auth.sessionTracking, '', 'should set empty sessionTracking by default')
	test.deepEqual(Object.keys(auth.sessions), [], 'should initialize empty sessions')
	test.equal(Object.getPrototypeOf(auth.sessions), null, 'should initialize sessions without a prototype')
	test.end()
})

tape('Auth constructor: applies serverconfig features', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const auth = makeAuth(
		{},
		{
			port: 4000,
			features: { sessionTracking: 'jwt-only', maxSessionAge: 60000 }
		}
	)
	test.equal(auth.port, 4000, 'should set port from serverconfig.port')
	test.equal(auth.sessionTracking, 'jwt-only', 'should set sessionTracking from serverconfig.features')
	test.equal(auth.maxSessionAge, 60000, 'should set maxSessionAge from serverconfig.features')
	test.end()
})

tape('getRequiredCred: returns undefined when no dslabel in query', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const result = auth.getRequiredCred({ dslabel: undefined }, '/termdb')
	test.equal(result, undefined, 'should return undefined when dslabel is missing from query')
	test.end()
})

tape('getRequiredCred: returns undefined for unprotected path/dslabel combination', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const result = auth.getRequiredCred({ dslabel: 'unknownDs', embedder }, '/termdb')
	test.equal(result, undefined, 'should return undefined for unmatched dslabel')
	test.end()
})

tape('getRequiredCred: returns cred for matching termdb/matrix route', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const result = auth.getRequiredCred({ dslabel, embedder }, '/termdb/matrix')
	test.ok(result, 'should return a cred for a matching termdb/matrix route')
	test.end()
})

tape('getRequiredCred: /jwt-status route returns cred for matching embedder', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const result = auth.getRequiredCred({ dslabel, embedder, route: 'termdb' }, '/jwt-status')
	test.ok(result, 'should return cred for /jwt-status route')
	test.end()
})

tape('getRequiredCred: burden route returns cred', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds = {
		[dslabel]: {
			burden: {
				[embedder]: makeCred({ route: 'burden' })
			}
		}
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	const result = auth.getRequiredCred({ dslabel, embedder }, '/burden')
	test.ok(result, 'should return cred for burden route')
	test.end()
})

tape('getRequiredCred: glob dslabel and embedder keys', function (test) {
	test.timeoutAfter(500)

	const termdbCred = makeCred({ dslabel: 'realD*' })
	const burdenCred = makeCred({ dslabel: 'realD*', route: 'burden' })
	const allRoutesCred = makeCred({ dslabel: 'glob*', route: '/**' })
	const creds = {
		'realD*': {
			termdb: { '*.example.org': termdbCred },
			burden: { '*.example.org': burdenCred }
		},
		'glob*': {
			'/**': { '*.example.org': allRoutesCred }
		}
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	const embedder = 'portal.example.org'

	test.equal(
		auth.getRequiredCred({ dslabel: 'realDs1', embedder }, '/termdb/matrix'),
		termdbCred,
		'should return the termdb cred for glob-matched dslabel and embedder keys'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'realDs1', embedder }, '/burden'),
		burdenCred,
		'should return the burden cred for glob-matched dslabel and embedder keys'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'realDs1', embedder, route: 'termdb' }, '/jwt-status'),
		termdbCred,
		'should return the cred for /jwt-status with glob-matched dslabel and embedder keys'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'globDs', embedder }, '/termdb/matrix'),
		allRoutesCred,
		'should return the all-routes cred for glob-matched dslabel and embedder keys'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'realDs1', embedder: 'other.org' }, '/termdb/matrix'),
		undefined,
		'should return undefined when the embedder does not match the glob key'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'otherDs', embedder }, '/termdb/matrix'),
		undefined,
		'should return undefined when the dslabel does not match any glob key'
	)
	test.end()
})

tape('getRequiredCred: exact keys take precedence over glob and wildcard keys', function (test) {
	test.timeoutAfter(500)

	const exactCred = makeCred({ dslabel: 'realDs1' })
	const globCred = makeCred({ dslabel: 'realD*' })
	const wildcardCred = makeCred({ dslabel: '*' })
	const creds = {
		'*': { termdb: { '*': wildcardCred } },
		'realD*': { termdb: { '*': globCred } },
		realDs1: {
			termdb: { 'portal.example.org': exactCred, '*.example.org': globCred }
		}
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	test.equal(
		auth.getRequiredCred({ dslabel: 'realDs1', embedder: 'portal.example.org' }, '/termdb/matrix'),
		exactCred,
		'should prefer the exact dslabel and embedder keys'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'realDs2', embedder: 'portal.example.org' }, '/termdb/matrix'),
		globCred,
		'should prefer a glob dslabel key over the wildcard dslabel key'
	)
	test.equal(
		auth.getRequiredCred({ dslabel: 'otherDs', embedder: 'a/b' }, '/termdb/matrix'),
		wildcardCred,
		'should fall back to the wildcard dslabel and embedder keys'
	)
	test.end()
})

tape('getRequiredCred: checks lower-precedence dslabel entries for a route', function (test) {
	test.timeoutAfter(500)

	const burdenCred = makeCred({ dslabel: 'realDs1', route: 'burden' })
	const termdbCred = makeCred({ dslabel: 'realD*' })
	const creds = {
		// the exact entry has no termdb route
		realDs1: { burden: { '*': burdenCred } },
		'realD*': { termdb: { '*.example.org': termdbCred } }
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	const q = { dslabel: 'realDs1', embedder: 'portal.example.org' }
	test.equal(
		auth.getRequiredCred(q, '/termdb/matrix'),
		termdbCred,
		'should return the termdb cred from a glob entry when the exact entry has no termdb route'
	)
	test.equal(
		auth.getRequiredCred({ ...q, route: 'termdb' }, '/jwt-status'),
		termdbCred,
		'should return the same termdb cred for /jwt-status'
	)
	test.equal(auth.getRequiredCred(q, '/burden'), burdenCred, 'should return the burden cred from the exact entry')
	test.end()
})

tape('getMatchedEntry: exact, then glob, then wildcard key precedence', function (test) {
	test.timeoutAfter(500)

	const obj = {
		// declared first, to confirm that key order in the object does not affect precedence
		'*': 'wildcard',
		'*.example.org': 'glob',
		'portal.example.org': 'exact'
	}
	test.equal(getMatchedEntry(obj, 'portal.example.org'), 'exact', 'should prefer an exact key')
	test.equal(getMatchedEntry(obj, 'other.example.org'), 'glob', 'should prefer a glob key over the wildcard key')
	test.equal(getMatchedEntry(obj, 'other.org'), 'wildcard', 'should fall back to the wildcard key')
	test.equal(getMatchedEntry(obj, 'a/b'), 'wildcard', 'should fall back to the wildcard key for a value with a slash')
	test.equal(
		getMatchedEntry({ '*.example.org': 'glob' }, 'other.org'),
		undefined,
		'should return undefined with no match'
	)
	test.end()
})

tape('getRequiredCred: a glob embedder key takes precedence over the wildcard embedder key', function (test) {
	test.timeoutAfter(500)

	const forbiddenCred = makeCred({ type: 'forbidden' })
	const loginCred = makeCred()
	const creds = {
		[dslabel]: {
			termdb: {
				'*': forbiddenCred,
				'*.example.org': loginCred
			}
		}
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	test.equal(
		auth.getRequiredCred({ dslabel, embedder: 'portal.example.org' }, '/termdb/matrix'),
		loginCred,
		'should return the login cred for an embedder that matches the glob key'
	)
	test.equal(
		auth.getRequiredCred({ dslabel, embedder: 'other.org' }, '/termdb/matrix'),
		forbiddenCred,
		'should return the forbidden cred for an embedder that only matches the wildcard key'
	)
	test.end()
})

tape('getRequiredCred: uses wildcard dslabel when specific dslabel not found', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		'*': {
			termdb: {
				[embedder]: makeCred()
			}
		}
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	const result = auth.getRequiredCred({ dslabel: 'anyDs', embedder }, '/termdb/matrix')
	test.ok(result, 'should match wildcard dslabel (*) when exact dslabel not found')
	test.end()
})

tape('normalizeReqPath: lowercases and strips trailing slashes', function (test) {
	test.timeoutAfter(500)
	test.deepEqual(
		['/TERMDB', '/termdb/matrix/', '/Termdb/SampleScatter//', '/', 'termdb/', '', undefined].map(p =>
			normalizeReqPath(p as any)
		),
		['/termdb', '/termdb/matrix', '/termdb/samplescatter', '/', 'termdb', '', ''],
		'should normalize request paths the way Express non-strict, case-insensitive routing does'
	)
	test.end()
})

// Express routes case-insensitively and ignores a trailing slash, so these paths reach the
// protected handlers and must not bypass the auth check
tape('getRequiredCred: matches protected termdb routes regardless of case or trailing slash', function (test) {
	test.timeoutAfter(500)

	const auth = makeAuth()
	for (const path of ['/TERMDB/MATRIX', '/termdb/matrix/', '/Termdb/Matrix//', '/termdb/MATRIX']) {
		test.ok(auth.getRequiredCred({ dslabel, embedder }, path), `should return a cred for path='${path}'`)
	}
	for (const path of ['/TERMDB', '/termdb/']) {
		test.ok(
			auth.getRequiredCred({ dslabel, embedder, for: 'getAllSamples' }, path, auth.protectedRoutes.samples),
			`should return a cred for path='${path}' with for=getAllSamples`
		)
	}
	for (const path of ['/termdb/SampleScatter', '/TERMDB/samplescatter/', '/termdb/sampleScatter']) {
		test.ok(
			auth.getRequiredCred({ dslabel, embedder }, path, auth.protectedRoutes.samples),
			`should return a cred for path='${path}'`
		)
	}
	test.end()
})

tape('getRequiredCred: matches cred.protectedRoutes regardless of case or trailing slash', function (test) {
	test.timeoutAfter(500)

	const auth = makeAuth({ protectedRoutes: ['/termdb/sampleScatter'] })
	for (const path of ['/termdb/SAMPLESCATTER', '/termdb/samplescatter/']) {
		test.ok(auth.getRequiredCred({ dslabel, embedder }, path), `should return a cred for path='${path}'`)
	}
	test.end()
})

tape('getRequiredCred: matches burden route regardless of case or trailing slash', function (test) {
	test.timeoutAfter(500)

	const creds = { [dslabel]: { burden: { [embedder]: makeCred({ route: 'burden' }) } } }
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	for (const path of ['/BURDEN', '/burden/', '/Burden']) {
		test.ok(auth.getRequiredCred({ dslabel, embedder }, path), `should return a cred for path='${path}'`)
	}
	test.end()
})

tape('getRequiredCred: matches configured route patterns regardless of case or trailing slash', function (test) {
	test.timeoutAfter(500)

	const creds = { [dslabel]: { '/customRoute': { [embedder]: makeCred({ route: '/customRoute' }) } } }
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	for (const path of ['/CUSTOMROUTE', '/customroute/', '/customRoute']) {
		test.ok(auth.getRequiredCred({ dslabel, embedder }, path), `should return a cred for path='${path}'`)
	}
	test.end()
})

tape('stripBasepath: removes a matching basepath prefix from the normalized path', function (test) {
	test.timeoutAfter(500)
	const cases = [
		['/api/termdb/matrix', '/api', '/termdb/matrix'],
		['/API/TERMDB/MATRIX/', '/api', '/termdb/matrix'],
		['/api/termdb', '/Api/', '/termdb'],
		['/api//termdb', '/api/', '/termdb'],
		['/api', '/api', '/'],
		['/api/', '/api', '/'],
		['/apix/termdb', '/api', '/apix/termdb'],
		['/termdb/matrix', '/api', '/termdb/matrix'],
		['/termdb/matrix', '', '/termdb/matrix'],
		['/termdb/matrix', '/', '/termdb/matrix'],
		['termdb', '/api', 'termdb']
	]
	for (const [path, basepath, expected] of cases) {
		test.equal(
			stripBasepath(path, basepath),
			expected,
			`should return '${expected}' for path='${path}', basepath='${basepath}'`
		)
	}
	test.end()
})

// the auth middleware is not mounted under the basepath, so req.path includes it
tape('getRequiredCred: matches protected routes under a configured basepath', function (test) {
	test.timeoutAfter(500)

	const auth = makeAuth()
	test.equal(auth.basepath, '', 'should default to an empty basepath')
	// set by AuthApi.maySetAuthRoutes() in the server
	auth.basepath = '/api'
	for (const path of ['/api/termdb/matrix', '/API/TERMDB/MATRIX/', '/api/termdb/matrix/']) {
		test.ok(auth.getRequiredCred({ dslabel, embedder }, path), `should return a cred for path='${path}'`)
	}
	for (const path of ['/api/termdb', '/Api/Termdb/']) {
		test.ok(
			auth.getRequiredCred({ dslabel, embedder, for: 'getAllSamples' }, path, auth.protectedRoutes.samples),
			`should return a cred for path='${path}' with for=getAllSamples`
		)
	}
	test.ok(
		auth.getRequiredCred({ dslabel, embedder }, '/api/termdb/sampleScatter', auth.protectedRoutes.samples),
		'should return a cred for /api/termdb/sampleScatter'
	)
	test.ok(
		auth.getRequiredCred({ dslabel, embedder, route: 'termdb' }, '/api/jwt-status'),
		'should return a cred for /api/jwt-status'
	)
	test.notOk(auth.getRequiredCred({ dslabel, embedder }, '/api/genomes'), 'should not protect an unrelated route')

	const creds = {
		[dslabel]: {
			burden: { [embedder]: makeCred({ route: 'burden' }) },
			'/customRoute': { [embedder]: makeCred({ route: '/customRoute' }) }
		}
	}
	const auth2 = new Auth(creds, {}, {}, { port: 3000 })
	auth2.basepath = '/api'
	for (const path of ['/api/burden', '/API/BURDEN/', '/api/customRoute', '/api/CUSTOMROUTE/']) {
		test.ok(auth2.getRequiredCred({ dslabel, embedder }, path), `should return a cred for path='${path}'`)
	}
	test.end()
})

tape('getJwtPayload: returns undefined when cred is falsy', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const result = auth.getJwtPayload({ embedder }, {}, null)
	test.equal(result, undefined, 'should return undefined when cred is falsy')
	test.end()
})

tape('getJwtPayload: throws when embedder is missing', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred()
	try {
		auth.getJwtPayload({}, {}, cred)
		test.fail('should have thrown for missing embedder')
	} catch (e) {
		test.ok(String(e).includes('missing q.embedder'), 'should throw mentioning missing q.embedder')
	}
	test.end()
})

tape('getJwtPayload: throws when cred has no secret', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ secret: undefined })
	try {
		auth.getJwtPayload({ embedder }, {}, cred)
		test.fail('should have thrown for missing secret')
	} catch (e: any) {
		test.ok(e.error?.includes('no credentials'), 'should throw mentioning no credentials')
	}
	test.end()
})

tape('getJwtPayload: throws when header key is missing from headers', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred()
	try {
		auth.getJwtPayload({ embedder }, {}, cred)
		test.fail('should have thrown for missing header token')
	} catch (e) {
		test.ok(String(e).includes('missing header'), 'should throw mentioning missing header')
	}
	test.end()
})

tape('getJwtPayload: returns payload for valid token with datasets', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth({ dsnames: [{ id: dslabel, label: 'Test Dataset' }] })
	const cred = auth.creds[dslabel].termdb[embedder]
	const token = jsonwebtoken.sign(
		{
			iat: time,
			exp: time + 300,
			datasets: [dslabel],
			email: 'user@test.com',
			ip: '127.0.0.1'
		},
		secret
	)
	const headers = { [cred.headerKey]: token }

	const result = auth.getJwtPayload({ embedder, dslabel }, headers, cred)
	test.ok(result, 'should return a payload for a valid token')
	test.equal(result?.email, 'user@test.com', 'should include the email from the payload')
	test.end()
})

tape('getJwtPayload: throws for expired token', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	// exp in the past
	const expiredToken = jsonwebtoken.sign({ iat: time - 600, exp: time - 300, datasets: [dslabel] }, secret)
	const headers = { [cred.headerKey]: expiredToken }

	try {
		auth.getJwtPayload({ embedder, dslabel }, headers, cred)
		test.fail('should have thrown for an expired token')
	} catch (e: any) {
		test.ok(e.message === 'jwt expired' || String(e).includes('expired'), 'should throw an expired token error')
	}
	test.end()
})

tape('getJwtPayload: throws for invalid signature', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	const badToken = jsonwebtoken.sign({ iat: time, exp: time + 300, datasets: [dslabel] }, 'wrong-secret')
	const headers = { [cred.headerKey]: badToken }

	try {
		auth.getJwtPayload({ embedder, dslabel }, headers, cred)
		test.fail('should have thrown for an invalid signature')
	} catch (e: any) {
		test.ok(
			e.message === 'invalid signature' || String(e).includes('invalid signature'),
			'should throw an invalid signature error'
		)
	}
	test.end()
})

tape('getJwtPayload: throws for missing dataset access', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth({ dsnames: [{ id: dslabel, label: 'Test Dataset' }] })
	const cred = auth.creds[dslabel].termdb[embedder]
	const token = jsonwebtoken.sign(
		{
			iat: time,
			exp: time + 300,
			datasets: ['OTHER-DS'],
			email: 'user@test.com'
		},
		secret
	)
	const headers = { [cred.headerKey]: token }

	try {
		auth.getJwtPayload({ embedder, dslabel }, headers, cred)
		test.fail('should have thrown for missing dataset access')
	} catch (e: any) {
		test.ok(e.error === 'Missing access', 'should throw an error about missing access')
	}
	test.end()
})

tape('checkIPaddress: passes when ipCheck is none', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ ipCheck: 'none' })
	try {
		auth.checkIPaddress({ ip: '1.2.3.4' }, '127.0.0.1', cred)
		test.pass('should not throw when ipCheck is none')
	} catch (e) {
		test.fail(`should not throw: ${e}`)
	}
	test.end()
})

tape('checkIPaddress: passes for loose check with IPv6 request IP', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ ipCheck: 'loose' })
	try {
		auth.checkIPaddress({ ip: '::1' }, '127.0.0.1', cred)
		test.pass('should not throw for loose check with IPv6 request IP')
	} catch (e) {
		test.fail(`should not throw: ${e}`)
	}
	test.end()
})

tape('checkIPaddress: throws for missing IP with strict check', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred()
	try {
		auth.checkIPaddress({ ip: '127.0.0.1' }, null, cred)
		test.fail('should have thrown for missing IP in session')
	} catch (e) {
		test.ok(String(e).includes('missing ip'), 'should throw mentioning missing ip')
	}
	test.end()
})

tape('checkIPaddress: throws for IP mismatch with strict check', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred()
	try {
		auth.checkIPaddress({ ip: '10.0.0.1' }, '127.0.0.1', cred)
		test.fail('should have thrown for IP mismatch')
	} catch (e) {
		test.ok(String(e).includes('connection has changed'), 'should throw mentioning connection change')
	}
	test.end()
})

tape('checkIPaddress: passes when req.ip matches session IP', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred()
	try {
		auth.checkIPaddress({ ip: '127.0.0.1' }, '127.0.0.1', cred)
		test.pass('should not throw when IP addresses match')
	} catch (e) {
		test.fail(`should not throw: ${e}`)
	}
	test.end()
})

tape('getSessionIdFromJwt: returns last 20 characters of jwt', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const jwt = 'header.payload.signature1234567890abcde'
	const id = auth.getSessionIdFromJwt(jwt)
	test.equal(id.length, 20, 'should return exactly 20 characters')
	test.equal(id, jwt.slice(-20), 'should return the last 20 characters of the jwt')
	test.end()
})

tape('getSessionId: returns session id from cookie', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ cookieId: 'myCookieId' })
	const req = {
		cookies: { myCookieId: 'cookie-session-value' },
		headers: {}
	}
	const id = auth.getSessionId(req, cred)
	test.equal(id, 'cookie-session-value', 'should return session id from cookie matching cookieId')
	test.end()
})

tape('getSessionId: returns session id from x-sjppds-sessionid header', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ cookieId: 'nonexistent-cookie' })
	const req = {
		cookies: {},
		headers: { 'x-sjppds-sessionid': 'header-session-value' },
		query: {}
	}
	const id = auth.getSessionId(req, cred)
	test.equal(id, 'header-session-value', 'should return session id from x-sjppds-sessionid header')
	test.end()
})

tape('getSessionId: returns session id from query param x-sjppds-sessionid', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ cookieId: 'nonexistent-cookie' })
	const req = {
		cookies: {},
		headers: {},
		query: { 'x-sjppds-sessionid': 'query-session-value' }
	}
	const id = auth.getSessionId(req, cred)
	test.equal(id, 'query-session-value', 'should return session id from query param x-sjppds-sessionid')
	test.end()
})

tape('getSignedJwt: returns undefined when cred has no secret', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = makeCred({ secret: undefined })
	const req = { ip: '127.0.0.1', headers: {} }
	const res = { header() {} }
	const q = { dslabel, embedder }
	const sessions = {}
	const result = auth.getSignedJwt(req, res, q, cred, {}, 60000, 'user@test.com', sessions)
	test.equal(result, undefined, 'should return undefined when cred has no secret')
	test.end()
})

tape('getSignedJwt: creates a valid jwt and stores session', function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	const req = { ip: '127.0.0.1', headers: {} }
	let setCookieCalled = false
	const res = {
		header(key: string) {
			if (key === 'Set-Cookie') setCookieCalled = true
		}
	}
	const q = { dslabel, embedder }
	const sessions: any = {}
	const clientAuthResult = { role: 'user' }
	const jwt = auth.getSignedJwt(req, res, q, cred, clientAuthResult, 60000, 'user@test.com', sessions)
	test.equal(typeof jwt, 'string', 'should return a jwt string')
	test.ok(jwt && jwt.length > 50, 'should return a non-trivial jwt string')
	test.ok(sessions[dslabel], 'should create a session entry for the dslabel')
	test.equal(setCookieCalled, true, `should include Set-Cookie in the response header`)
	test.end()
})

tape('getSignedJwt: a dslabel of __proto__ does not pollute Object.prototype', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	const req = { ip: '127.0.0.1', headers: {} }
	const res = { header() {} }
	const q = { dslabel: '__proto__', embedder }
	// a plain {} sessions map, same as this file's other getSignedJwt tests use, rather than
	// the null-prototype auth.sessions -- this method must be safe independently of that
	const sessions: any = {}
	auth.getSignedJwt(req, res, q, cred, { role: 'user' }, 60000, 'user@test.com', sessions)

	test.ok(Object.hasOwn(sessions, '__proto__'), 'stores the dslabel entry as a real own __proto__ key')
	const sessionIds = Object.keys(sessions['__proto__'])
	test.equal(sessionIds.length, 1, 'stores exactly one session under that dslabel')
	test.notOk(({} as any)[sessionIds[0]], 'does not pollute Object.prototype with the session id')
	test.end()
})

tape('mayAddSessionFromJwt: returns undefined when no authorization header', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	const req = { headers: {}, query: { dslabel, embedder } }
	const result = auth.mayAddSessionFromJwt({}, req, cred)
	test.equal(result, undefined, 'should return undefined when no authorization header is present')
	test.end()
})

tape('mayAddSessionFromJwt: throws for unsupported authorization type', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	const req = {
		headers: { authorization: 'Basic abc123' },
		query: { dslabel, embedder }
	}
	try {
		auth.mayAddSessionFromJwt({}, req, cred)
		test.fail('should have thrown for unsupported authorization type')
	} catch (e) {
		test.ok(
			String(e).includes('unsupported authorization type'),
			'should throw mentioning unsupported authorization type'
		)
	}
	test.end()
})

tape('mayAddSessionFromJwt: adds session from valid bearer jwt', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	// Create a session jwt (has dslabel property)
	const payload = {
		dslabel,
		embedder,
		route: 'termdb',
		iat: time,
		exp: time + 300,
		email: 'user@test.com',
		ip: '127.0.0.1',
		time: Date.now()
	}
	const sessionJwt = jsonwebtoken.sign(payload, secret)
	const b64token = Buffer.from(sessionJwt).toString('base64')
	const req = {
		headers: { authorization: `Bearer ${b64token}` },
		query: { dslabel, embedder },
		path: '/termdb'
	}
	const sessions: any = {}
	const id = auth.mayAddSessionFromJwt(sessions, req, cred)
	test.ok(id, 'should return a session id from a valid bearer jwt')
	test.ok(sessions[dslabel]?.[id], 'should add the session to the sessions object')
	test.end()
})

tape('mayAddSessionFromJwt: a dslabel of __proto__ does not pollute Object.prototype', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const auth = makeAuth()
	const cred = auth.creds[dslabel].termdb[embedder]
	const payload = {
		dslabel: '__proto__',
		embedder,
		route: 'termdb',
		iat: time,
		exp: time + 300,
		email: 'user@test.com',
		ip: '127.0.0.1',
		time: Date.now()
	}
	const sessionJwt = jsonwebtoken.sign(payload, secret)
	const b64token = Buffer.from(sessionJwt).toString('base64')
	const req = {
		headers: { authorization: `Bearer ${b64token}` },
		query: { dslabel: '__proto__', embedder },
		path: '/termdb'
	}
	// a plain {} sessions map, same as this file's other mayAddSessionFromJwt tests use, rather
	// than the null-prototype auth.sessions -- this method must be safe independently of that
	const sessions: any = {}
	const id = auth.mayAddSessionFromJwt(sessions, req, cred)
	test.ok(id, 'should return a session id')
	test.ok(Object.hasOwn(sessions, '__proto__'), 'stores the dslabel entry as a real own __proto__ key')
	test.notOk(({} as any)[id as any], 'does not pollute Object.prototype with the session id')
	test.end()
})

tape('mayAddSessionFromJwt: matches the signed route under a configured basepath', function (test) {
	test.timeoutAfter(500)

	const auth = makeAuth()
	auth.basepath = '/api'
	const cred = auth.creds[dslabel].termdb[embedder]
	const payload = { dslabel, embedder, route: 'termdb', iat: time, exp: time + 300, email: 'user@test.com' }
	const b64token = Buffer.from(jsonwebtoken.sign(payload, secret)).toString('base64')
	for (const path of ['/api/termdb', '/API/TERMDB/MATRIX/', '/api/authorizedActions']) {
		const req = { headers: { authorization: `Bearer ${b64token}` }, query: { dslabel, embedder }, path }
		test.ok(auth.mayAddSessionFromJwt({}, req, cred), `should return a session id for path='${path}'`)
	}
	const req = { headers: { authorization: `Bearer ${b64token}` }, query: { dslabel, embedder }, path: '/api/burden' }
	test.notOk(auth.mayAddSessionFromJwt({}, req, cred), 'should not return a session id for a different route')
	test.end()
})

tape(
	'mayAddSessionFromJwt: matches the signed route regardless of request path case or trailing slash',
	function (test) {
		test.timeoutAfter(500)

		const auth = makeAuth()
		const cred = auth.creds[dslabel].termdb[embedder]
		const payload = { dslabel, embedder, route: 'termdb', iat: time, exp: time + 300, email: 'user@test.com' }
		const b64token = Buffer.from(jsonwebtoken.sign(payload, secret)).toString('base64')
		for (const path of ['/TERMDB', '/termdb/MATRIX/', '/authorizedActions']) {
			const req = { headers: { authorization: `Bearer ${b64token}` }, query: { dslabel, embedder }, path }
			test.ok(auth.mayAddSessionFromJwt({}, req, cred), `should return a session id for path='${path}'`)
		}
		test.end()
	}
)

// a non-string client-supplied value, e.g. an array from `embedder[]=...`, must not resolve to no credential
tape('getNonStringAuthParam: returns the first auth query param that is present but not a string', function (test) {
	test.timeoutAfter(500)
	test.equal(getNonStringAuthParam({ dslabel, embedder }), undefined, 'should accept string values')
	test.equal(getNonStringAuthParam({ dslabel }), undefined, 'should accept a missing embedder')
	test.equal(getNonStringAuthParam({ dslabel: [dslabel] }), 'dslabel', 'should reject an array dslabel')
	test.equal(getNonStringAuthParam({ dslabel, embedder: [embedder] }), 'embedder', 'should reject an array embedder')
	test.equal(getNonStringAuthParam({ dslabel, genome: { a: 1 } }), 'genome', 'should reject an object genome')
	test.equal(getNonStringAuthParam({ dslabel, route: ['termdb'] }), 'route', 'should reject an array route')
	test.end()
})

tape('getRequiredCred: fails closed for a non-string embedder or dslabel', function (test) {
	test.timeoutAfter(500)

	const exactEmbedder = 'portal.example.org'
	const auth = makeAuth()
	auth.creds[dslabel].termdb = { [exactEmbedder]: makeCred() }
	test.ok(
		auth.getRequiredCred({ dslabel, embedder: exactEmbedder }, '/termdb/matrix'),
		'should return the cred for the exact embedder'
	)
	for (const [q, label] of [
		[{ dslabel, embedder: [exactEmbedder] }, 'embedder[]'],
		[{ dslabel, embedder: { 0: exactEmbedder } }, 'an object embedder'],
		[{ dslabel: [dslabel], embedder: exactEmbedder }, 'dslabel[]']
	] as any) {
		test.throws(() => auth.getRequiredCred(q, '/termdb/matrix'), /must be a string/, `should throw for ${label}`)
		test.throws(
			() => auth.getRequiredCred({ ...q, for: 'getAllSamples' }, '/termdb', auth.protectedRoutes.samples),
			/must be a string/,
			`should throw for ${label} with for=getAllSamples`
		)
	}
	test.throws(
		() => getMatchedEntry({ '*': makeCred() }, [embedder]),
		/must be a string/,
		'getMatchedEntry should throw for an array'
	)
	test.ok(
		getMatchedEntry({ '*': makeCred() }, undefined),
		"getMatchedEntry should still use '*' for an undefined value"
	)
	test.end()
})
