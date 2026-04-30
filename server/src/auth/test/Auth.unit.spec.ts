import tape from 'tape'
import jsonwebtoken from 'jsonwebtoken'
import { Auth } from '#src/auth/Auth.ts'

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
	test.plan(4)

	const auth = makeAuth()
	test.equal(auth.port, 3000, 'should set port from serverconfig')
	test.equal(auth.maxSessionAge, 1000 * 3600 * 16, 'should set default maxSessionAge')
	test.equal(auth.sessionTracking, '', 'should set empty sessionTracking by default')
	test.deepEqual(auth.sessions, {}, 'should initialize empty sessions')
	test.end()
})

tape('Auth constructor: applies serverconfig features', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const auth = makeAuth({}, { port: 4000, features: { sessionTracking: 'jwt-only', maxSessionAge: 60000 } })
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

tape('getRequiredCred: returns cred for matching termdb route and for=matrix', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const result = auth.getRequiredCred({ dslabel, embedder, for: 'matrix' }, '/termdb')
	test.ok(result, 'should return a cred for a matching termdb route with a protected for=matrix query')
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
	const result = auth.getRequiredCred({ dslabel: 'anyDs', embedder, for: 'matrix' }, '/termdb')
	test.ok(result, 'should match wildcard dslabel (*) when exact dslabel not found')
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
		{ iat: time, exp: time + 300, datasets: [dslabel], email: 'user@test.com', ip: '127.0.0.1' },
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
		{ iat: time, exp: time + 300, datasets: ['OTHER-DS'], email: 'user@test.com' },
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
