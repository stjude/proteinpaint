import tape from 'tape'
import jsonwebtoken from 'jsonwebtoken'
import { promises as fs } from 'fs'
import path from 'path'
import { setAuthRoutes } from '#src/auth/AuthRoutes.ts'
import { Auth } from '#src/auth/Auth.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'authroutes-unit-test-secret' // pragma: allowlist secret
const password = 'test-password-123' // pragma: allowlist secret
const time = Math.floor(Date.now() / 1000)
const dslabel = 'testDs'
const embedder = 'localhost'
const headerKey = 'x-ds-access-token'
const cachedir = '/tmp'

// Pre-shaped JWT credential stored under the 'termdb' route key
function makeJwtCred(overrides: any = {}) {
	return {
		type: 'jwt',
		secret,
		headerKey,
		authRoute: '/jwt-status',
		route: 'termdb',
		cookieId: headerKey,
		dslabel,
		...overrides
	}
}

// Pre-shaped basic credential stored under the '/**' route key
// Basic auth uses '/**' so it matches all paths (including /dslogout via the generic loop)
function makeBasicCred(overrides: any = {}) {
	return {
		type: 'basic',
		secret,
		headerKey,
		authRoute: '/dslogin',
		route: '/**',
		cookieId: headerKey,
		dslabel,
		password,
		...overrides
	}
}

// Creates an Auth instance with a JWT cred under 'termdb'
function makeAuthWithJwt(credOpts: any = {}, genomes: any = {}, serverconfig: any = {}) {
	const creds: any = {
		[dslabel]: {
			termdb: {
				[embedder]: makeJwtCred(credOpts)
			}
		}
	}
	return new Auth(creds, {}, genomes, { port: 3000, ...serverconfig })
}

// Creates an Auth instance with a basic cred under '/**'
// This is what validateDsCredentials produces for basic/password auth.
function makeAuthWithBasic(credOpts: any = {}, genomes: any = {}) {
	const creds: any = {
		[dslabel]: {
			'/**': {
				[embedder]: makeBasicCred(credOpts)
			}
		}
	}
	return new Auth(creds, {}, genomes, { port: 3000 })
}

// Build a mock express app and register routes, returning the app
function makeApp(auth: Auth, basepath = '') {
	const app: any = {
		routes: {} as Record<string, any>
	}
	const methods = ['get', 'post', 'put', 'delete', 'all']
	for (const method of methods) {
		app[method] = (route: string, handler: any) => {
			if (!app.routes[route]) app.routes[route] = {}
			app.routes[route][method] = handler
		}
	}
	setAuthRoutes(app, auth, basepath, { cachedir })
	return app
}

// Mock response object
function makeMockRes() {
	const res: any = {
		statusCode: 200,
		sentData: null,
		headers: {} as Record<string, string>,
		status(code: number) {
			res.statusCode = code
			return res
		},
		send(data: any) {
			res.sentData = data
			return res
		},
		header(key: string, val: string) {
			res.headers[key] = val
			return res
		}
	}
	return res
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/AuthRoutes -***-')
	test.end()
})

// ─────────────────────────────────────────
// setAuthRoutes: route registration
// ─────────────────────────────────────────

tape('setAuthRoutes: registers all expected routes', function (test) {
	test.timeoutAfter(500)
	test.plan(6)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	const routes = Object.keys(app.routes).sort()

	test.deepEqual(
		routes,
		['/authorizedActions', '/demoToken', '/dslogin', '/dslogout', '/jwt-status'],
		'should register the 5 expected routes'
	)
	test.ok(app.routes['/dslogin']?.post, 'should register POST /dslogin')
	test.ok(app.routes['/dslogout']?.post, 'should register POST /dslogout')
	test.ok(app.routes['/jwt-status']?.post, 'should register POST /jwt-status')
	test.ok(app.routes['/authorizedActions']?.post, 'should register POST /authorizedActions')
	test.ok(app.routes['/demoToken']?.post, 'should register POST /demoToken')
	test.end()
})

tape('setAuthRoutes: basepath is prepended to all routes', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth, '/api')
	const routes = Object.keys(app.routes).sort()

	test.deepEqual(
		routes,
		['/api/authorizedActions', '/api/demoToken', '/api/dslogin', '/api/dslogout', '/api/jwt-status'],
		'should prepend basepath to all registered routes'
	)
	test.end()
})

// ─────────────────────────────────────────
// POST /dslogin
// ─────────────────────────────────────────

tape('/dslogin: returns 400 when no credential is required for the dataset', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	// Use unknown dslabel so getRequiredCred returns falsy
	const req = {
		query: { dslabel: 'unknown-ds', embedder },
		path: '/dslogin',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/dslogin'].post(req, res)
	test.equal(res.statusCode, 400, 'should set 400 status for unknown dataset')
	test.ok(res.sentData?.error, 'should send an error message')
	test.end()
})

tape('/dslogin: returns 400 when cred uses a different authRoute', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	// JWT cred has authRoute='/jwt-status', but we call /dslogin → should fail with 400
	const auth = makeAuthWithJwt({ authRoute: '/jwt-status' })
	const app = makeApp(auth)
	// getRequiredCred for /dslogin uses ds0[q.route] || ds0['/**']
	// The cred is under 'termdb' so q.route='termdb' is needed
	const req = {
		query: { dslabel, embedder, route: 'termdb' },
		path: '/dslogin',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/dslogin'].post(req, res)
	test.equal(res.statusCode, 400, 'should set 400 status when wrong authRoute')
	test.ok(
		String(res.sentData?.error).includes('/jwt-status'),
		'should mention the correct auth route in error'
	)
	test.end()
})

tape('/dslogin: returns 401 when authorization header is missing', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	// Basic cred under '/**' - getRequiredCred for /dslogin: ds0[undefined] || ds0['/**'] → found
	const auth = makeAuthWithBasic({ authRoute: '/dslogin' })
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder },
		path: '/dslogin',
		headers: {} // no authorization header
	}
	const res = makeMockRes()

	await app.routes['/dslogin'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 status for missing auth header')
	test.ok(String(res.sentData?.error).includes('missing authorization header'), 'should mention missing header')
	test.end()
})

tape('/dslogin: returns 401 for unsupported authorization type', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithBasic({ authRoute: '/dslogin' })
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder },
		path: '/dslogin',
		headers: { authorization: 'Bearer abc123' } // Bearer, not Basic
	}
	const res = makeMockRes()

	await app.routes['/dslogin'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for non-Basic auth type')
	test.ok(String(res.sentData?.error).includes('unsupported authorization type'), 'should mention unsupported type')
	test.end()
})

tape('/dslogin: returns 401 for invalid password', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithBasic({ authRoute: '/dslogin' })
	const app = makeApp(auth)
	const wrongPwd = Buffer.from('wrong-password').toString('base64')
	const req = {
		query: { dslabel, embedder },
		path: '/dslogin',
		headers: { authorization: `Basic ${wrongPwd}` }
	}
	const res = makeMockRes()

	await app.routes['/dslogin'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for invalid password')
	test.ok(String(res.sentData?.error).includes('invalid password'), 'should mention invalid password')
	test.end()
})

tape('/dslogin: returns ok with jwt on successful basic login', async function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const auth = makeAuthWithBasic({ authRoute: '/dslogin' })
	const app = makeApp(auth)
	const encodedPwd = Buffer.from(password).toString('base64')
	const req = {
		query: { dslabel, embedder },
		path: '/dslogin',
		headers: { authorization: `Basic ${encodedPwd}` },
		ip: '127.0.0.1',
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/dslogin'].post(req, res)
	test.equal(res.statusCode, 200, 'should return 200 on successful login')
	test.equal(res.sentData?.status, 'ok', 'should send status ok')
	test.ok(res.sentData?.jwt, 'should include a jwt in the response')
	test.end()
})

// ─────────────────────────────────────────
// POST /dslogout
// ─────────────────────────────────────────

tape('/dslogout: returns 401 when no session cookie is present', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder },
		path: '/dslogout',
		headers: {},
		cookies: {} // no session cookie
	}
	const res = makeMockRes()

	await app.routes['/dslogout'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 when no session cookie')
	test.ok(res.sentData?.error, 'should send an error message')
	test.end()
})

tape('/dslogout: returns ok when session does not exist (already expired)', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder },
		path: '/dslogout',
		headers: {},
		cookies: { 'x-ds-access-token': 'nonexistent-session-id' }
	}
	const res = makeMockRes()

	await app.routes['/dslogout'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when session not found')
	test.equal(res.statusCode, 200, 'should return 200 status')
	test.end()
})

tape('/dslogout: deletes session and clears cookie on valid logout', async function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	// Use '/**' route key so getRequiredCred finds the cred for /dslogout path
	const auth = makeAuthWithBasic()
	const sessionId = 'test-logout-session-id'
	auth.sessions[dslabel] = { [sessionId]: { time: Date.now(), ip: '127.0.0.1' } }

	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder },
		path: '/dslogout',
		headers: {},
		cookies: { 'x-ds-access-token': sessionId }
	}
	const res = makeMockRes()

	await app.routes['/dslogout'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok status on successful logout')
	test.equal(res.statusCode, 200, 'should return 200 status')
	test.equal(auth.sessions[dslabel][sessionId], undefined, 'should remove session from auth.sessions')
	test.ok(res.headers['Set-Cookie']?.includes(`${headerKey}=;`), 'should clear the session cookie')
	test.end()
})

// ─────────────────────────────────────────
// POST /jwt-status
// ─────────────────────────────────────────

tape('/jwt-status: returns ok when no credential is required', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	// Use unknown dslabel so getRequiredCred returns falsy
	const req = {
		query: { dslabel: 'no-cred-ds', embedder },
		path: '/jwt-status',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when no cred required')
	test.equal(res.statusCode, 200, 'should return 200 status')
	test.end()
})

tape('/jwt-status: returns 401 when jwt header is missing', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, route: 'termdb' },
		path: '/jwt-status',
		headers: {} // no headerKey header
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 when jwt header is missing')
	test.ok(res.sentData?.error, 'should send an error message')
	test.end()
})

tape('/jwt-status: returns 401 when jwt signature is invalid', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	const badToken = jsonwebtoken.sign({ iat: time, exp: time + 300 }, 'wrong-secret')
	const req = {
		query: { dslabel, embedder, route: 'termdb' },
		path: '/jwt-status',
		headers: { [headerKey]: badToken }
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for invalid jwt signature')
	test.ok(res.sentData?.error || res.sentData?.message, 'should send an error or message')
	test.end()
})

tape('/jwt-status: returns ok with new session jwt on valid login token', async function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	// Login token: no dslabel in payload (triggers getSignedJwt), include ip for IP check
	const loginToken = jsonwebtoken.sign(
		{ iat: time, exp: time + 300, email: 'user@test.com', ip: '127.0.0.1' },
		secret
	)
	const req = {
		query: { dslabel, embedder, route: 'termdb' },
		path: '/jwt-status',
		headers: { [headerKey]: loginToken },
		ip: '127.0.0.1',
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok on valid login token')
	test.equal(res.statusCode, 200, 'should return 200 status')
	test.ok(res.sentData?.jwt, 'should return a new session jwt')
	test.equal(res.sentData?.route, 'termdb', 'should return the route in the response')
	test.end()
})

tape('/jwt-status: returns ok and generates new session jwt even when session token is provided', async function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	// A "session" jwt may include dslabel, but getJwtPayload never returns dslabel,
	// so getSignedJwt is always called and a new session jwt is generated
	const sessionToken = jsonwebtoken.sign(
		{ iat: time, exp: time + 300, dslabel, email: 'user@test.com', ip: '127.0.0.1' },
		secret
	)
	const req = {
		query: { dslabel, embedder, route: 'termdb' },
		path: '/jwt-status',
		headers: { [headerKey]: sessionToken },
		ip: '127.0.0.1',
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when a session token is provided')
	test.equal(res.statusCode, 200, 'should return 200')
	// A new session jwt is generated (not the same as the input token)
	test.ok(res.sentData?.jwt, 'should return a new session jwt')
	test.end()
})

tape('/jwt-status: clears cookie and returns error when jwt is expired', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	const expiredToken = jsonwebtoken.sign(
		{ iat: time - 7200, exp: time - 3600, email: 'user@test.com', ip: '127.0.0.1' },
		secret
	)
	const req = {
		query: { dslabel, embedder, route: 'termdb' },
		path: '/jwt-status',
		headers: { [headerKey]: expiredToken },
		ip: '127.0.0.1',
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for expired token')
	test.ok(res.headers['Set-Cookie']?.includes(`${headerKey}=;`), 'should clear the cookie on error')
	test.end()
})

tape('/jwt-status: returns 401 when embedder query is missing but cred requires it', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	// Use wildcard embedder ('*') so cred IS found even without q.embedder,
	// then getJwtPayload throws 'missing q.embedder'
	const creds: any = {
		[dslabel]: {
			termdb: {
				'*': makeJwtCred() // wildcard embedder
			}
		}
	}
	const auth = new Auth(creds, {}, {}, { port: 3000 })
	const app = makeApp(auth)
	const loginToken = jsonwebtoken.sign({ iat: time, exp: time + 300, email: 'user@test.com' }, secret)
	const req = {
		// No embedder in query - will reach getJwtPayload which throws 'missing q.embedder'
		query: { dslabel, route: 'termdb' },
		path: '/jwt-status',
		headers: { [headerKey]: loginToken },
		ip: '127.0.0.1',
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/jwt-status'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for missing embedder')
	test.ok(res.sentData?.error, 'should send an error message')
	test.end()
})

// ─────────────────────────────────────────
// POST /authorizedActions
// ─────────────────────────────────────────

tape('/authorizedActions: returns ok when no credential is required', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app = makeApp(auth)
	// No termdb-matching cred for 'authorizedActions' path check
	const req = {
		query: { dslabel: 'no-cred-ds', embedder, action: 'view', details: '{}' },
		path: '/authorizedActions',
		headers: {},
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/authorizedActions'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when no cred required')
	test.equal(res.statusCode, 200, 'should return 200')
	test.end()
})

tape('/authorizedActions: appends action to file and returns ok', async function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	const auth = makeAuthWithJwt()
	const sessionId = 'test-action-session-id'
	auth.sessions[dslabel] = { [sessionId]: { time: Date.now(), ip: '127.0.0.1', email: 'user@test.com' } }

	const app = makeApp(auth)
	const actionFile = path.join(cachedir, 'authorizedActions')

	try {
		await fs.unlink(actionFile)
	} catch {
		// ok if it doesn't exist
	}

	const req = {
		query: { dslabel, embedder, action: 'download', details: JSON.stringify({ key: 'val' }) },
		path: '/authorizedActions',
		headers: {},
		cookies: { 'x-ds-access-token': sessionId }
	}
	const res = makeMockRes()

	await app.routes['/authorizedActions'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok after appending action')
	test.equal(res.statusCode, 200, 'should return 200')

	const content = await fs.readFile(actionFile, 'utf8')
	test.ok(content.includes(dslabel), 'action file should include the dslabel')
	test.ok(content.includes('download'), 'action file should include the action name')
	test.end()
})

tape('/authorizedActions: returns 401 on file system error', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt()
	const app: any = { routes: {} as Record<string, any> }
	const methods = ['get', 'post', 'put', 'delete', 'all']
	for (const method of methods) {
		app[method] = (route: string, handler: any) => {
			if (!app.routes[route]) app.routes[route] = {}
			app.routes[route][method] = handler
		}
	}
	// Invalid cachedir to trigger file-write error
	setAuthRoutes(app, auth, '', { cachedir: '/nonexistent/path/to/nowhere' })

	const req = {
		query: { dslabel, embedder, action: 'export', details: '{}' },
		path: '/authorizedActions',
		headers: {},
		cookies: {}
	}
	const res = makeMockRes()

	await app.routes['/authorizedActions'].post(req, res)
	test.equal(res.statusCode, 401, 'should return 401 on write error')
	test.ok(res.sentData, 'should send error data')
	test.end()
})

// ─────────────────────────────────────────
// POST /demoToken
// ─────────────────────────────────────────

tape('/demoToken: returns 401 for invalid genome', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuthWithJwt({}, {} /* empty genomes */)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user' },
		path: '/demoToken',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for invalid genome')
	test.ok(String(res.sentData?.error).includes('invalid genome'), 'should mention invalid genome')
	test.end()
})

tape('/demoToken: returns 401 for invalid dslabel', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const genomes = { hg38: { datasets: {} } }
	const auth = makeAuthWithJwt({}, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user' },
		path: '/demoToken',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for invalid dslabel')
	test.ok(String(res.sentData?.error).includes('invalid dslabel'), 'should mention invalid dslabel')
	test.end()
})

tape('/demoToken: returns 401 when ds.demoJwtInput is missing', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } } // no demoJwtInput
	const auth = makeAuthWithJwt({}, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user' },
		path: '/demoToken',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 when demoJwtInput is missing')
	test.ok(String(res.sentData?.error).includes('demoJwtInput'), 'should mention missing demoJwtInput')
	test.end()
})

tape('/demoToken: returns ok when no credential is required for the dataset', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const genomes = { hg38: { datasets: { 'no-cred-ds': { demoJwtInput: { user: {} } } } } }
	const auth = makeAuthWithJwt({}, genomes)
	const app = makeApp(auth)
	// Use a dslabel not in creds so getRequiredCred returns falsy
	const req = {
		query: { dslabel: 'no-cred-ds', embedder, genome: 'hg38', role: 'user' },
		path: '/demoToken',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when no cred required')
	test.equal(res.statusCode, 200, 'should return 200')
	test.end()
})

tape('/demoToken: returns 401 when cred has no demoToken config', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const genomes = { hg38: { datasets: { [dslabel]: { demoJwtInput: { user: {} } } } } }
	const auth = makeAuthWithJwt({}, genomes) // no demoToken in cred
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user', route: 'termdb' },
		path: '/demoToken',
		headers: {}
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 when demoToken config missing')
	test.ok(
		String(res.sentData?.error).includes('demoToken requests are not accepted'),
		'should mention demoToken requests are not accepted'
	)
	test.end()
})

tape('/demoToken: returns 401 when role is not in demoToken.roles', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const demoToken = {
		secret,
		roles: ['admin'],
		referers: ['example.com'],
		computedByRole: {}
	}
	const genomes = { hg38: { datasets: { [dslabel]: { demoJwtInput: { admin: {} } } } } }
	const auth = makeAuthWithJwt({ demoToken }, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user', route: 'termdb' }, // 'user' not in roles
		path: '/demoToken',
		headers: { referer: 'https://example.com/test' }
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 for unsupported role')
	test.ok(String(res.sentData?.error).includes('not supported for role'), 'should mention role is not supported')
	test.end()
})

tape('/demoToken: returns 401 when referer does not match', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const demoToken = {
		secret,
		roles: ['user'],
		referers: ['example.com'],
		computedByRole: {}
	}
	const genomes = { hg38: { datasets: { [dslabel]: { demoJwtInput: { user: {} } } } } }
	const auth = makeAuthWithJwt({ demoToken }, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user', route: 'termdb' },
		path: '/demoToken',
		headers: { referer: 'https://other-site.com/page' } // does not match 'example.com'
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.statusCode, 401, 'should set 401 when referer does not match')
	test.ok(
		String(res.sentData?.error).includes('not accepted from referer'),
		'should mention referer is not accepted'
	)
	test.end()
})

tape('/demoToken: returns ok with new jwt on successful demo token request', async function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	const demoSecret = 'demo-token-secret' // pragma: allowlist secret
	const demoToken = {
		secret: demoSecret,
		roles: ['user'],
		referers: ['example.com'],
		computedByRole: {}
	}
	const genomes = {
		hg38: {
			datasets: {
				[dslabel]: {
					demoJwtInput: {
						user: { datasets: [dslabel] }
					}
				}
			}
		}
	}
	const auth = makeAuthWithJwt({ demoToken }, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user', route: 'termdb' },
		path: '/demoToken',
		headers: { referer: 'https://example.com/demo' },
		ip: '127.0.0.1'
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok on successful demo token request')
	test.equal(res.statusCode, 200, 'should return 200')
	test.ok(res.sentData?.fakeTokensByRole?.user, 'should return a fakeToken for the requested role')

	const decoded: any = jsonwebtoken.decode(res.sentData.fakeTokensByRole.user)
	test.deepEqual(decoded?.datasets, [dslabel], 'should include the dataset in the token payload')
	test.end()
})

tape('/demoToken: returns cached jwt when not close to expiring', async function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const demoSecret = 'demo-token-secret-2' // pragma: allowlist secret
	const cachedJwt = 'cached-jwt-value'
	const futureExp = Date.now() + 3600000 // 1 hour from now (well above 60 second buffer)
	const demoToken = {
		secret: demoSecret,
		roles: ['user'],
		referers: ['example.com'],
		computedByRole: {
			user: { jwt: cachedJwt, exp: futureExp }
		}
	}
	const genomes = { hg38: { datasets: { [dslabel]: { demoJwtInput: { user: {} } } } } }
	const auth = makeAuthWithJwt({ demoToken }, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user', route: 'termdb' },
		path: '/demoToken',
		headers: { referer: 'https://example.com/demo' }
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when using cached token')
	test.equal(res.statusCode, 200, 'should return 200')
	test.equal(res.sentData?.fakeTokensByRole?.user, cachedJwt, 'should return the cached jwt without regenerating')
	test.end()
})

tape('/demoToken: generates new jwt when cached token is close to expiring', async function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const demoSecret = 'demo-token-secret-3' // pragma: allowlist secret
	const oldJwt = 'expiring-jwt-value'
	const nearlyExpiredTime = Date.now() + 30000 // 30 seconds from now (within the 60 second buffer)
	const demoToken = {
		secret: demoSecret,
		roles: ['user'],
		referers: ['example.com'],
		computedByRole: {
			user: { jwt: oldJwt, exp: nearlyExpiredTime }
		}
	}
	const genomes = { hg38: { datasets: { [dslabel]: { demoJwtInput: { user: { datasets: [dslabel] } } } } } }
	const auth = makeAuthWithJwt({ demoToken }, genomes)
	const app = makeApp(auth)
	const req = {
		query: { dslabel, embedder, genome: 'hg38', role: 'user', route: 'termdb' },
		path: '/demoToken',
		headers: { referer: 'https://example.com/demo' },
		ip: '127.0.0.1'
	}
	const res = makeMockRes()

	await app.routes['/demoToken'].post(req, res)
	test.equal(res.sentData?.status, 'ok', 'should return ok when regenerating expired token')
	test.equal(res.statusCode, 200, 'should return 200')
	test.notEqual(res.sentData?.fakeTokensByRole?.user, oldJwt, 'should generate a new jwt, not the old one')
	test.end()
})

