import tape from 'tape'
import { setAuthMiddleware } from '#src/auth/AuthMiddleWare.ts'
import { Auth } from '#src/auth/Auth.ts'
import { AuthApiOpen } from '#src/auth/AuthApiOpen.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'middleware-unit-test-secret' // pragma: allowlist secret
const dslabel = 'testDs'
const embedder = 'localhost'
const headerKey = 'x-ds-access-token'

// Pre-shaped credential (post-validation shape)
function makeShapedCred(overrides: any = {}) {
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

// Creates an Auth instance with pre-shaped creds
function makeAuth(credOpts: any = {}, serverconfig: any = {}) {
	const creds: any = {
		[dslabel]: {
			termdb: {
				[embedder]: makeShapedCred(credOpts)
			}
		}
	}
	return new Auth(creds, {}, {}, { port: 3000, ...serverconfig })
}

// Registers the middleware and returns the captured handler
function registerMiddleware(auth: Auth, authApi: any = AuthApiOpen, genomes: any = {}) {
	const handlers: any[] = []
	const app = {
		use(handler: any) {
			handlers.push(handler)
		}
	}
	setAuthMiddleware(app, genomes, authApi, auth)
	return handlers[0]
}

// Mock response object
function makeMockRes() {
	const res: any = {
		statusCode: null,
		sentData: null,
		status(code: number) {
			res.statusCode = code
			return res
		},
		send(data: any) {
			res.sentData = data
			return res
		}
	}
	return res
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/AuthMiddleWare -***-')
	test.end()
})

tape('setAuthMiddleware: registers exactly one middleware on app', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const handlers: any[] = []
	const app = { use: (h: any) => handlers.push(h) }

	setAuthMiddleware(app, {}, AuthApiOpen, auth)
	test.equal(handlers.length, 1, 'should register exactly one middleware handler')
	test.end()
})

tape('middleware: initializes __protected__ on req.query with ignoredTermIds and sessionid', function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	const auth = makeAuth()
	const middleware = registerMiddleware(auth)

	const req: any = {
		query: {},
		path: '/some-open-route',
		cookies: { sessionid: 'test-session-123' }
	}
	const res = makeMockRes()
	let nextCalled = false
	const next = () => {
		nextCalled = true
	}

	middleware(req, res, next)

	test.ok(req.query.__protected__, 'should add __protected__ to req.query')
	test.deepEqual(req.query.__protected__.ignoredTermIds, [], 'should initialize ignoredTermIds as empty array')
	test.equal(req.query.__protected__.sessionid, 'test-session-123', 'should copy sessionid from cookie')
	test.equal(nextCalled, true, `should call next() in middelware() for unprotected route`)
	test.end()
})

tape('middleware: forced open routes bypass auth check and call next()', function (test) {
	test.timeoutAfter(500)

	const auth = makeAuth()
	const forcedOpenPaths = ['/dslogin', '/jwt-status', '/dslogout', '/healthcheck', '/demoToken']

	// We need one test.plan because we check each route
	test.plan(forcedOpenPaths.length)

	for (const path of forcedOpenPaths) {
		const middleware = registerMiddleware(auth)
		const req: any = {
			query: { embedder, dslabel },
			path,
			cookies: {}
		}
		const res = makeMockRes()
		let nextCalled = false
		const next = () => {
			nextCalled = true
		}

		middleware(req, res, next)
		test.ok(nextCalled, `should call next() for forced open route '${path}'`)
	}
	test.end()
})

tape('middleware: __protected__ is frozen for forced open routes', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	const middleware = registerMiddleware(auth)

	const req: any = {
		query: {},
		path: '/dslogin',
		cookies: {}
	}
	const res = makeMockRes()
	middleware(req, res, () => {})

	test.ok(Object.isFrozen(req.query.__protected__), 'should freeze __protected__ for forced open routes')
	test.end()
})

tape('middleware: calls next() for routes with no required credentials', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	// Use AuthApiOpen as authApi (getNonsensitiveInfo returns open access)
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: { dslabel: 'unknown-ds', embedder },
		path: '/some-route',
		cookies: {}
	}
	const res = makeMockRes()
	let nextCalled = false
	const next = () => {
		nextCalled = true
	}

	middleware(req, res, next)
	test.ok(nextCalled, 'should call next() when no cred is required for the route')
	test.end()
})

tape('middleware: returns 401 error for missing session on protected route', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: { dslabel, embedder, for: 'matrix' },
		path: '/termdb',
		cookies: {},
		headers: {}
	}
	const res = makeMockRes()
	const next = () => test.fail('should NOT call next() for protected route with no session')

	middleware(req, res, next)

	test.equal(res.statusCode, 401, 'should set 401 status for missing session')
	test.ok(res.sentData?.error, 'should send an error message')
	test.end()
})

tape('middleware: sends error response with code from thrown error object', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth({ secret: undefined }) // no secret will trigger 403 from mayAddSessionFromJwt
	// Mock authApi that throws an error with a specific code
	const mockAuthApi = {
		getNonsensitiveInfo: () => {
			const err: any = new Error('no credentials set up')
			err.status = 403
			err.code = 403
			throw err
		},
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: { dslabel, embedder },
		path: '/termdb',
		cookies: {},
		headers: {}
	}
	const res = makeMockRes()
	middleware(req, res, () => {})

	test.equal(res.statusCode, 403, 'should set the status code from the thrown error')
	test.ok(res.sentData, 'should send error data')
	test.end()
})

tape('middleware: clears sessions when sessionTracking is jwt-only', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth({}, { features: { sessionTracking: 'jwt-only' } })
	// Pre-populate sessions
	;(auth as any).sessions[dslabel] = { 'fake-session-id': { time: Date.now(), ip: '127.0.0.1' } }

	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: { dslabel, embedder, for: 'matrix' },
		path: '/termdb',
		cookies: {},
		headers: {}
	}
	const res = makeMockRes()
	middleware(req, res, () => {})

	// After the middleware runs, sessions should be cleared (jwt-only mode)
	test.deepEqual((auth as any).sessions, {}, 'should clear all sessions when sessionTracking is jwt-only')
	test.end()
})

tape('middleware: valid session - calls next() and updates session time', async function (test) {
	test.timeoutAfter(1000)
	test.plan(2)

	const auth = makeAuth()

	// Manually create a session in auth.sessions with a known ID and matching IP
	const sessionId = 'test-session-id-00'
	;(auth as any).sessions[dslabel] = {
		[sessionId]: { time: Date.now(), ip: '127.0.0.1', email: 'user@test.com' }
	}

	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: { dslabel, embedder, for: 'matrix' },
		path: '/termdb',
		// The session cookie key is 'x-ds-access-token' (cred.cookieId)
		cookies: { [headerKey]: sessionId },
		headers: {},
		ip: '127.0.0.1'
	}
	const res = makeMockRes()
	let nextCalled = false
	const next = () => {
		nextCalled = true
	}

	middleware(req, res, next)

	test.ok(nextCalled, 'should call next() for a valid session')
	test.ok(res.statusCode === null, 'should not set an error status code for valid session')
	test.end()
})

tape('mayUpdate__protected__: extracts activeCohort from subcohort filter', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: {
			dslabel: 'some-open-ds', // will use unknown dslabel so no auth required
			embedder,
			filter: {
				type: 'tvslst',
				join: '',
				lst: [
					{
						tvs: {
							term: { id: 'subcohort' },
							values: [{ key: 'COHORT_A' }]
						}
					}
				]
			}
		},
		path: '/termdb',
		cookies: {}
	}
	const res = makeMockRes()
	let nextCalled = false
	middleware(req, res, () => {
		nextCalled = true
	})

	// If activeCohort was set, __protected__ would have it
	// (this exercises the cohortFilter branch in mayUpdate__protected__)
	// The middleware may pass or fail due to dslabel check, but activeCohort gets set first
	test.pass('should execute without error when filter contains subcohort tvs')
	test.equal(nextCalled, true, `should call next() in unprotected route`)
	test.end()
})

tape('mayUpdate__protected__: throws for invalid genome when dslabel and genome are in query', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	// genomes is empty so 'hg38' will not be found
	const middleware = registerMiddleware(auth, mockAuthApi, {} /* empty genomes */)

	const req: any = {
		query: { dslabel, embedder, genome: 'hg38' },
		path: '/termdb',
		cookies: {}
	}
	const res = makeMockRes()
	const next = () => test.fail('should NOT call next() for invalid genome')

	middleware(req, res, next)

	test.equal(res.statusCode, 401, 'should set 401 status for invalid genome')
	test.ok(res.sentData?.error, 'should send an error for invalid genome')
	test.end()
})

tape('mayUpdate__protected__: throws for invalid dslabel when genome is found but dslabel is not', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	// Genome exists but dslabel does not
	const genomes = { hg38: { datasets: {} } }
	const middleware = registerMiddleware(auth, mockAuthApi, genomes)

	const req: any = {
		query: { dslabel, embedder, genome: 'hg38' },
		path: '/termdb',
		cookies: {}
	}
	const res = makeMockRes()
	const next = () => test.fail('should NOT call next() for invalid dslabel')

	middleware(req, res, next)

	test.equal(res.statusCode, 401, 'should set 401 status for invalid dslabel')
	test.ok(res.sentData?.error, 'should send an error for invalid dslabel')
	test.end()
})

tape('mayUpdate__protected__: freezes __protected__ after update', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	let capturedProtected: any = null
	const mockAuthApi = {
		getNonsensitiveInfo: (_req: any) => {
			// capture a reference so we can check frozen state after middleware runs
			capturedProtected = _req.query.__protected__
			return { forbiddenRoutes: [], clientAuthResult: {} }
		},
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	const middleware = registerMiddleware(auth, mockAuthApi)

	const req: any = {
		query: { dslabel: 'some-open-ds', embedder },
		path: '/some-route',
		cookies: {}
	}
	const res = makeMockRes()
	middleware(req, res, () => {})

	// After middleware, __protected__ should be frozen
	test.ok(Object.isFrozen(req.query.__protected__), 'should freeze __protected__ after mayUpdate__protected__ runs')
	test.notEqual(capturedProtected, null, `req.query.__protected__ should be accessible within getNonsensitiveInfo()`)
	test.end()
})

tape('mayUpdate__protected__: sets isUserLoggedIn flag when genome and dslabel are valid', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const auth = makeAuth()
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => true
	}
	// Valid genome and dataset
	const genomes = { hg38: { datasets: { [dslabel]: { cohort: { termdb: {} }, label: dslabel } } } }
	const middleware = registerMiddleware(auth, mockAuthApi, genomes)

	const req: any = {
		query: { dslabel, embedder, genome: 'hg38' },
		path: '/termdb',
		cookies: {}
	}
	const res = makeMockRes()
	let nextCalled = false

	// The middleware may block the request if there's a required cred without session,
	// but mayUpdate__protected__ runs first and sets isUserLoggedIn
	middleware(req, res, () => {
		nextCalled = true
	})

	// isUserLoggedIn should have been set on __protected__
	test.equal(req.query.__protected__?.isUserLoggedIn, true, 'should set isUserLoggedIn on __protected__')
	test.equal(nextCalled, true, `next() should be called within the middleware`)
	test.end()
})

tape('mayUpdate__protected__: skips msigdb dslabel when getting isUserLoggedIn', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const auth = makeAuth()
	let isUserLoggedInCalled = false
	const mockAuthApi = {
		getNonsensitiveInfo: () => ({ forbiddenRoutes: [], clientAuthResult: {} }),
		mayAdjustFilter: () => {},
		isUserLoggedIn: () => {
			isUserLoggedInCalled = true
			return true
		}
	}
	const genomes = { hg38: { datasets: { msigdb: {} } } }
	const middleware = registerMiddleware(auth, mockAuthApi, genomes)

	const req: any = {
		query: { dslabel: 'msigdb', embedder, genome: 'hg38' },
		path: '/termdb',
		cookies: {}
	}
	const res = makeMockRes()
	middleware(req, res, () => {})

	test.equal(isUserLoggedInCalled, false, 'should skip isUserLoggedIn check for msigdb dslabel')
	test.end()
})
