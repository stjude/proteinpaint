import tape from 'tape'
import jsonwebtoken from 'jsonwebtoken'
import { AuthApi } from '#src/auth/AuthApi.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'authapi-unit-test-secret' // pragma: allowlist secret
const time = Math.floor(Date.now() / 1000)
const dslabel = 'ds0'
const embedder = 'localhost'
const headerKey = 'x-ds-access-token'

// Pre-shaped credential (the shape after validateDsCredentials has processed it)
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

// Mock express app
function makeMockApp() {
	const app: any = {
		routes: {},
		middlewares: {},
		use(...args: any[]) {
			const handler = args[1] || args[0]
			if (args.length == 1) app.middlewares['*'] = handler
			else app.middlewares[args[0]] = handler
		},
		post(route: string, handler: any) {
			if (!app.routes[route]) app.routes[route] = {}
			app.routes[route].post = handler
		},
		get(route: string, handler: any) {
			if (!app.routes[route]) app.routes[route] = {}
			app.routes[route].get = handler
		}
	}
	return app
}

// Creates AuthApi with pre-shaped credentials (bypassing validateDsCredentials)
function makeAuthApi(credOpts: any = {}, genomes: any = {}, serverconfigOverrides: any = {}) {
	const creds = {
		[dslabel]: {
			termdb: {
				[embedder]: makeShapedCred(credOpts)
			}
		}
	}
	const app = makeMockApp()
	const authApi = new AuthApi(creds, app, genomes, { port: 3000, cachedir: '/tmp', ...serverconfigOverrides })
	return { authApi, app, creds }
}

// Creates AuthApi with routes set up (so /jwt-status etc. are available)
async function makeAuthApiWithRoutes(credOpts: any = {}, genomes: any = {}, serverconfigOverrides: any = {}) {
	const { authApi, app, creds } = makeAuthApi(credOpts, genomes, serverconfigOverrides)
	const serverconfig = { port: 3000, cachedir: '/tmp', ...serverconfigOverrides }
	await authApi.maySetAuthRoutes(app, genomes, '', serverconfig)
	return { authApi, app, creds }
}

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/AuthApi -***-')
	test.end()
})

tape('AuthApi constructor: credEmbedders is an empty array', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const { authApi } = makeAuthApi()
	test.ok(Array.isArray(authApi.credEmbedders), 'credEmbedders should be an array')
	test.equal(authApi.credEmbedders.length, 0, 'credEmbedders should be empty after construction')
	test.end()
})

tape('AuthApi.maySetAuthRoutes: registers middleware and auth routes', async function (test) {
	test.timeoutAfter(1000)
	test.plan(2)

	const { authApi, app } = makeAuthApi()
	await authApi.maySetAuthRoutes(app, {}, '', { port: 3000, cachedir: '/tmp' })

	test.ok(app.middlewares['*'], 'should register a global middleware')
	const routes = Object.keys(app.routes).sort()
	test.deepEqual(
		routes,
		['/authorizedActions', '/demoToken', '/dslogin', '/dslogout', '/jwt-status'],
		'should register the expected auth routes'
	)
	test.end()
})

tape('AuthApi.canDisplaySampleIds: returns false when displaySampleIds is not set on ds', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const ds = { cohort: { termdb: {} } }
	const req = { query: { embedder, dslabel }, headers: {}, path: '/termdb', cookies: {} }
	test.equal(authApi.canDisplaySampleIds(req, ds as any), false, 'should return false when displaySampleIds is falsy')
	test.end()
})

tape('AuthApi.canDisplaySampleIds: returns false when user is not logged in', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	// displaySampleIds is truthy but no session exists so isUserLoggedIn will check session
	const ds = { cohort: { termdb: { displaySampleIds: true } }, label: dslabel }
	const req = { query: { embedder, dslabel }, headers: {}, path: '/termdb', cookies: {} }
	// No session exists, so isUserLoggedIn returns false for protected routes
	const result = authApi.canDisplaySampleIds(req, ds as any)
	// Since there's a required cred for the route but no session, result is false
	test.equal(typeof result, 'boolean', 'should return a boolean')
	test.end()
})

tape('AuthApi.getDsAuth: returns empty array when no active genomes', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi({}, {} /* no genomes */)
	const req = { query: { embedder }, headers: {}, cookies: {} }
	test.deepEqual(authApi.getDsAuth(req), [], 'should return empty array when no active genomes have matching dslabels')
	test.end()
})

tape('AuthApi.getDsAuth: returns auth info for active datasets', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } }
	const { authApi } = makeAuthApi({}, genomes)

	const req = {
		query: { embedder },
		headers: {},
		cookies: {},
		get: () => embedder
	}
	const result = authApi.getDsAuth(req)
	test.equal(result.length, 1, 'should return one auth entry')
	test.equal(result[0].dslabel, dslabel, 'should include the correct dslabel')
	test.equal(result[0].route, 'termdb', 'should include the correct route')
	test.end()
})

tape('AuthApi.getDsAuth: excludes entries for non-matching embedder', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } }
	// The cred is only for 'localhost', but we query with 'other-embedder'
	const { authApi } = makeAuthApi({}, genomes)
	const req = {
		query: { embedder: 'other-embedder' },
		headers: {},
		cookies: {},
		get: () => 'other-embedder'
	}
	const result = authApi.getDsAuth(req)
	// No cred has wildcard or 'other-embedder', so result should be empty
	test.deepEqual(result, [], 'should return empty array when embedder does not match any cred entry')
	test.end()
})

tape('AuthApi.getDsAuth: includes demoTokenRoles when referer matches', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } }
	const { authApi } = makeAuthApi(
		{
			demoToken: {
				roles: ['user', 'admin'],
				referers: ['example.com'],
				secret,
				computedByRole: {}
			}
		},
		genomes
	)
	const req = {
		query: { embedder },
		headers: { referer: 'https://example.com/test' },
		cookies: {},
		get: () => embedder
	}
	const result = authApi.getDsAuth(req)
	test.deepEqual(result[0]?.demoTokenRoles, ['user', 'admin'], 'should include demoTokenRoles when referer matches')
	test.end()
})

tape('AuthApi.getDsAuth: shows insession=false for jwt type with no session', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } }
	const { authApi } = makeAuthApi({ type: 'jwt' }, genomes)
	const req = {
		query: { embedder },
		headers: {},
		cookies: {},
		get: () => embedder
	}
	const result = authApi.getDsAuth(req)
	// jwt type with no session id means insession should be undefined (id is falsy)
	test.equal(
		result[0]?.insession,
		undefined,
		'should show insession=undefined when there is no session id for jwt type'
	)
	test.end()
})

tape('AuthApi.getDsAuth: shows insession=false for basic type with no session', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } }
	const { authApi } = makeAuthApi({ type: 'basic', secret: undefined }, genomes)
	const req = {
		query: { embedder },
		headers: {},
		cookies: {},
		get: () => embedder
	}
	const result = authApi.getDsAuth(req)
	test.equal(result[0]?.insession, false, 'should show insession=false for basic type with no session')
	test.end()
})

tape('AuthApi.getDsAuth: shows insession=true after session is established', async function (test) {
	test.timeoutAfter(1000)
	test.plan(1)

	const genomes = { hg38: { datasets: { [dslabel]: {} } } }
	// Token without 'datasets' field so the dsnames check is skipped
	const loginToken = jsonwebtoken.sign({ iat: time, exp: time + 300, ip: '127.0.0.1', email: 'user@test.com' }, secret)
	const { authApi, app } = await makeAuthApiWithRoutes({}, genomes)

	// Establish a session via /jwt-status and capture the session cookie
	let capturedSessionCookieId = ''
	let capturedSessionId = ''
	await new Promise<void>(resolve => {
		const req = {
			query: { embedder, dslabel },
			headers: { [headerKey]: loginToken },
			path: '/jwt-status',
			ip: '127.0.0.1',
			cookies: {}
		}
		const res = {
			send() {
				resolve()
			},
			header(key: string, val: string) {
				if (key === 'Set-Cookie') {
					const parts = val.split(';')[0].split('=')
					capturedSessionCookieId = parts[0]
					capturedSessionId = parts[1]
				}
			},
			status() {}
		}
		app.routes['/jwt-status'].post(req, res)
	})
	await sleep(50)

	// getDsAuth needs the session cookie to find the active session
	const req = {
		query: { embedder },
		headers: {},
		cookies: { [capturedSessionCookieId]: capturedSessionId },
		get: () => embedder
	}
	const result = authApi.getDsAuth(req)
	test.equal(result[0]?.insession, true, 'should show insession=true after session is established')
	test.end()
})

tape('AuthApi.getNonsensitiveInfo: throws when dslabel is missing', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	try {
		authApi.getNonsensitiveInfo({ query: {}, get: () => null } as any)
		test.fail('should have thrown for missing dslabel')
	} catch (e) {
		test.ok(String(e).includes('dslabel'), 'should throw mentioning dslabel')
	}
	test.end()
})

tape('AuthApi.getNonsensitiveInfo: throws when embedder cannot be determined', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	try {
		// dslabel set but no embedder and get() returns null
		authApi.getNonsensitiveInfo({ query: { dslabel }, get: () => null } as any)
		test.fail('should have thrown for missing embedder')
	} catch (e) {
		test.ok(String(e).includes('embedder'), 'should throw mentioning embedder')
	}
	test.end()
})

tape('AuthApi.getNonsensitiveInfo: returns open access for unknown dslabel', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const req = {
		query: { dslabel: 'unknown-ds', embedder },
		headers: {},
		cookies: {}
	}
	const result = authApi.getNonsensitiveInfo(req as any)
	test.deepEqual(result, { forbiddenRoutes: [], clientAuthResult: {} }, 'should return open access for unknown dslabel')
	test.end()
})

tape('AuthApi.getNonsensitiveInfo: returns forbidden routes for forbidden cred type', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const creds: any = {
		[dslabel]: {
			termdb: {
				[embedder]: makeShapedCred({ type: 'forbidden' })
			}
		}
	}
	const app = makeMockApp()
	const authApi = new AuthApi(creds, app, {}, { port: 3000, cachedir: '/tmp' })

	const req = {
		query: { dslabel, embedder },
		headers: {},
		cookies: {}
	}
	const result = authApi.getNonsensitiveInfo(req as any)
	test.ok(result.forbiddenRoutes.includes('termdb'), 'should include the forbidden route')
	test.deepEqual(result.clientAuthResult, {}, 'should return empty clientAuthResult')
	test.end()
})

tape('AuthApi.getNonsensitiveInfo: returns clientAuthResult from active session', async function (test) {
	test.timeoutAfter(1000)
	test.plan(1)

	const clientAuthResult = { role: 'user', access: 'full' }
	// Token without 'datasets' field so the dsnames check is skipped
	const loginToken = jsonwebtoken.sign(
		{
			iat: time,
			exp: time + 300,
			ip: '127.0.0.1',
			email: 'user@test.com',
			clientAuthResult
		},
		secret
	)
	const { authApi, app } = await makeAuthApiWithRoutes()

	// Establish a session
	let sessionCookieId = ''
	let sessionId = ''
	await new Promise<void>(resolve => {
		const req = {
			query: { embedder, dslabel },
			headers: { [headerKey]: loginToken },
			path: '/jwt-status',
			ip: '127.0.0.1',
			cookies: {}
		}
		const res = {
			send() {
				resolve()
			},
			header(_key: string, val: string) {
				if (_key === 'Set-Cookie') {
					const parts = val.split(';')[0].split('=')
					sessionCookieId = parts[0]
					sessionId = parts[1]
				}
			},
			status() {}
		}
		app.routes['/jwt-status'].post(req, res)
	})
	await sleep(50)

	const req = {
		query: { dslabel, embedder },
		headers: {},
		cookies: { [sessionCookieId]: sessionId }
	}
	const result = authApi.getNonsensitiveInfo(req as any)
	test.deepEqual(result.clientAuthResult, clientAuthResult, 'should return clientAuthResult from active session')
	test.end()
})

tape('AuthApi.getRequiredCredForDsEmbedder: returns undefined for non-matching dslabel', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const result = authApi.getRequiredCredForDsEmbedder('unknown-ds', embedder)
	test.equal(result, undefined, 'should return undefined when dslabel does not match any credential')
	test.end()
})

tape('AuthApi.getRequiredCredForDsEmbedder: returns undefined for non-matching embedder', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const result = authApi.getRequiredCredForDsEmbedder(dslabel, 'non-matching-embedder')
	test.equal(result, undefined, 'should return undefined when embedder does not match any credential')
	test.end()
})

tape('AuthApi.getRequiredCredForDsEmbedder: returns cred info for matching dslabel and embedder', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const { authApi } = makeAuthApi()
	const result = authApi.getRequiredCredForDsEmbedder(dslabel, embedder)
	test.ok(Array.isArray(result), 'should return an array')
	test.equal(result?.length, 1, 'should return one entry')
	test.equal(result?.[0].route, 'termdb', 'should include the correct route')
	test.end()
})

tape('AuthApi.getRequiredCredForDsEmbedder: matches wildcard embedder pattern', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const creds: any = {
		[dslabel]: {
			termdb: {
				'*': makeShapedCred({ cookieId: 'wildcard-cookie' })
			}
		}
	}
	const app = makeMockApp()
	const authApi = new AuthApi(creds, app, {}, { port: 3000, cachedir: '/tmp' })

	const result = authApi.getRequiredCredForDsEmbedder(dslabel, 'any-embedder')
	test.ok(result?.length, 'should return a match when embedder pattern is wildcard')
	test.end()
})

tape('AuthApi.isUserLoggedIn: returns true when no cred is required for the route', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	// A path that is not 'termdb' or 'burden' won't match any cred
	const req = { query: { embedder, dslabel: 'unknown-ds' }, headers: {}, path: '/some-open-route', cookies: {} }
	test.equal(
		authApi.isUserLoggedIn(req as any, { label: dslabel } as any, []),
		true,
		'should return true when no cred is required'
	)
	test.end()
})

tape('AuthApi.isUserLoggedIn: returns false when session is expired (no active session)', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const req = {
		query: { embedder, dslabel, for: 'matrix' },
		headers: {},
		path: '/termdb',
		cookies: {}
	}
	// The ds label must match what's in creds
	const result = authApi.isUserLoggedIn(req as any, { label: dslabel } as any, ['matrix'])
	test.equal(result, false, 'should return false when there is no active session')
	test.end()
})

tape('AuthApi.getPayloadFromHeaderAuth: returns {} when no authorization header', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const req = { query: { embedder, dslabel }, headers: {} }
	const result = authApi.getPayloadFromHeaderAuth(req as any, '/termdb')
	test.deepEqual(result, {}, 'should return empty object when no authorization header')
	test.end()
})

tape('AuthApi.getPayloadFromHeaderAuth: returns {} when no cred found for route', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const validToken = jsonwebtoken.sign({ iat: time, exp: time + 300 }, secret)
	const req = {
		query: { embedder, dslabel: 'unknown-ds' },
		headers: { authorization: `Bearer ${Buffer.from(validToken).toString('base64')}` }
	}
	const result = authApi.getPayloadFromHeaderAuth(req as any, '/some-route')
	test.deepEqual(result, {}, 'should return empty object when no cred found for route')
	test.end()
})

tape('AuthApi.getPayloadFromHeaderAuth: throws for non-bearer auth type', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const req = {
		query: { embedder, dslabel },
		headers: { authorization: 'Basic dXNlcjpwYXNz' }
	}
	// Use route='termdb' (without leading slash) to match via the loop in getRequiredCred
	try {
		authApi.getPayloadFromHeaderAuth(req as any, 'termdb')
		test.fail('should have thrown for non-bearer auth type')
	} catch (e) {
		test.ok(
			String(e).includes('unsupported authorization type'),
			'should throw mentioning unsupported authorization type'
		)
	}
	test.end()
})

tape('AuthApi.getPayloadFromHeaderAuth: returns jwt payload for valid bearer token', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const { authApi } = makeAuthApi()
	const email = 'test@example.com'
	const validToken = jsonwebtoken.sign({ iat: time, exp: time + 300, email, datasets: [dslabel] }, secret)
	const req = {
		query: { embedder, dslabel, for: 'matrix' },
		headers: { authorization: `Bearer ${Buffer.from(validToken).toString('base64')}` }
	}
	const result = authApi.getPayloadFromHeaderAuth(req as any, '/termdb')
	test.ok(result, 'should return a payload object')
	test.equal((result as any).email, email, 'should include the email from the payload')
	test.end()
})

tape('AuthApi.getHealth: returns empty errors when no credentials', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const app = makeMockApp()
	const authApi = new AuthApi({}, app, {}, { port: 3000, cachedir: '/tmp' })
	const result = await authApi.getHealth()
	test.ok(result, 'should return a health object')
	test.deepEqual((result as any).errors, [], 'should return empty errors when there are no credentials')
	test.end()
})

tape('AuthApi.getHealth: returns empty errors for jwt type (not health-checked)', async function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi({ type: 'jwt' })
	const result = await authApi.getHealth()
	test.deepEqual((result as any).errors, [], 'should return empty errors for jwt type credentials')
	test.end()
})

tape('AuthApi.getHealth: uses cached result on subsequent calls', async function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	// Use jwt creds (non-empty) so getHealth doesn't return early before caching
	const { authApi } = makeAuthApi({ type: 'jwt' })
	const result1 = await authApi.getHealth()
	const result2 = await authApi.getHealth()
	test.ok(result1, 'first call should return a result')
	test.equal(result1, result2, 'second call should return the same cached object reference')
	test.end()
})

tape('AuthApi.mayAdjustFilter: returns early when ds has no getAdditionalFilter', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const q: any = { filter: { type: 'tvslst', join: '', lst: [] } }
	const originalFilter = JSON.stringify(q.filter)
	const ds = { cohort: { termdb: {} } } // no getAdditionalFilter
	authApi.mayAdjustFilter(q, ds as any, undefined)
	test.equal(JSON.stringify(q.filter), originalFilter, 'should not modify filter when ds has no getAdditionalFilter')
	test.end()
})

tape('AuthApi.mayAdjustFilter: throws when q.__protected__ is missing', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const q: any = {} // no __protected__
	const ds = { cohort: { termdb: { getAdditionalFilter: () => null } } }
	try {
		authApi.mayAdjustFilter(q, ds as any, undefined)
		test.fail('should have thrown for missing __protected__')
	} catch (e) {
		test.ok(String(e).includes('missing q.__protected__'), 'should throw mentioning missing q.__protected__')
	}
	test.end()
})

tape('AuthApi.mayAdjustFilter: throws for invalid routeTwLst (non-array)', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const q: any = {
		__protected__: { clientAuthResult: {}, ignoredTermIds: [] }
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => null } } }
	try {
		authApi.mayAdjustFilter(q, ds as any, 'not-an-array' as any)
		test.fail('should have thrown for non-array routeTwLst')
	} catch (e) {
		test.ok(String(e).includes('invalid routeTwLst'), 'should throw mentioning invalid routeTwLst')
	}
	test.end()
})

tape('AuthApi.mayAdjustFilter: throws when clientAuthResult is missing from __protected__', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const q: any = {
		__protected__: {} // no clientAuthResult or ignoredTermIds
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => null } } }
	try {
		authApi.mayAdjustFilter(q, ds as any, undefined)
		test.fail('should have thrown for missing clientAuthResult')
	} catch (e) {
		test.ok(
			String(e).includes('missing q.__protected__ clientAuthResult or ignoredTermIds'),
			'should throw mentioning missing required __protected__ fields'
		)
	}
	test.end()
})

tape(
	'AuthApi.mayAdjustFilter: creates new filter when q.filter is not set and authFilter is returned',
	function (test) {
		test.timeoutAfter(500)
		test.plan(3)

		const { authApi } = makeAuthApi()
		const authFilter = { type: 'tvslst', join: '', lst: [{ tvs: { term: { id: 'subcohort' } } }] }
		const q: any = {
			__protected__: { clientAuthResult: {}, ignoredTermIds: [] }
		}
		const ds = { cohort: { termdb: { getAdditionalFilter: () => authFilter } } }

		authApi.mayAdjustFilter(q, ds as any, undefined)

		test.ok(q.filter, 'should create a filter')
		test.equal(q.filter.tag, 'termLevelAuthFilter', 'should tag the filter')
		test.equal(q.filter, authFilter, 'should set the authFilter directly as root filter when no prior filter')
		test.end()
	}
)

tape('AuthApi.mayAdjustFilter: pushes authFilter to existing filter.lst and sets join to and', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const { authApi } = makeAuthApi()
	const authFilter = { type: 'tvslst', join: '', lst: [{ tvs: { term: { id: 'someterm' } } }] }
	const existingEntry = { tvs: { term: { id: 'age' }, values: [] } }
	const q: any = {
		__protected__: { clientAuthResult: {}, ignoredTermIds: [] },
		filter: { type: 'tvslst', join: '', lst: [existingEntry] }
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => authFilter } } }

	authApi.mayAdjustFilter(q, ds as any, undefined)

	test.equal(q.filter.lst.length, 2, 'should add authFilter to existing filter.lst')
	test.equal(q.filter.join, 'and', 'should set filter.join to and')
	test.equal(q.filter.lst[1], authFilter, 'should push authFilter to the end of filter.lst')
	test.end()
})

tape('AuthApi.mayAdjustFilter: prepends authFilter using and when existing filter.join is or', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const { authApi } = makeAuthApi()
	const authFilter = { type: 'tvslst', join: '', lst: [] }
	const existingFilter = { type: 'tvslst', join: 'or', lst: [{ tvs: {} }, { tvs: {} }] }
	const q: any = {
		__protected__: { clientAuthResult: {}, ignoredTermIds: [] },
		filter: existingFilter
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => authFilter } } }

	authApi.mayAdjustFilter(q, ds as any, undefined)

	test.equal(q.filter.type, 'tvslst', 'should create a wrapping tvslst filter')
	test.equal(q.filter.join, 'and', 'should set join to and for the wrapping filter')
	test.equal(q.filter.lst[0], authFilter, 'should prepend authFilter as the first entry')
	test.end()
})

tape('AuthApi.mayAdjustFilter: removes prior FILTER_TAG entry when authFilter is null', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const { authApi } = makeAuthApi()
	const existingEntry = { tvs: { term: { id: 'age' }, values: [] } }
	const taggedEntry = { tag: 'termLevelAuthFilter', type: 'tvslst', join: '', lst: [] }
	const q: any = {
		__protected__: { clientAuthResult: { role: 'admin' }, ignoredTermIds: [] },
		filter: { type: 'tvslst', join: 'and', lst: [existingEntry, taggedEntry] }
	}
	// authFilter is null/undefined means full access
	const ds = { cohort: { termdb: { getAdditionalFilter: () => null } } }

	authApi.mayAdjustFilter(q, ds as any, undefined)

	test.equal(q.filter.lst.length, 1, 'should remove the auth filter entry')
	test.equal(q.filter.lst[0], existingEntry, 'should keep the non-tagged entry')
	test.end()
})

tape('AuthApi.mayAdjustFilter: replaces root filter when it has FILTER_TAG and authFilter is null', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const { authApi } = makeAuthApi()
	const q: any = {
		__protected__: { clientAuthResult: {}, ignoredTermIds: [] },
		filter: { tag: 'termLevelAuthFilter', type: 'tvslst', join: '', lst: [] }
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => null } } }

	authApi.mayAdjustFilter(q, ds as any, undefined)

	test.equal(q.filter.tag, undefined, 'should remove the tag from the replaced filter')
	test.deepEqual(q.filter, { type: 'tvslst', join: '', lst: [] }, 'should reset to empty root filter')
	test.end()
})

tape('AuthApi.mayAdjustFilter: replaces existing FILTER_TAG entry in filter.lst with new authFilter', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const { authApi } = makeAuthApi()
	const oldAuthFilter = { tag: 'termLevelAuthFilter', type: 'tvslst', join: '', lst: [] }
	const newAuthFilter = { type: 'tvslst', join: '', lst: [{ tvs: {} }] }
	const existingEntry = { tvs: { term: { id: 'age' }, values: [] } }
	const q: any = {
		__protected__: { clientAuthResult: {}, ignoredTermIds: [] },
		filter: { type: 'tvslst', join: 'and', lst: [existingEntry, oldAuthFilter] }
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => newAuthFilter } } }

	authApi.mayAdjustFilter(q, ds as any, undefined)

	test.equal(q.filter.lst.length, 2, 'should keep the same number of entries')
	test.equal(q.filter.lst[1], newAuthFilter, 'should replace the old auth filter entry with new one')
	test.end()
})

tape(
	'AuthApi.mayAdjustFilter: filters routeTwLst by ignoredTermIds before passing to getAdditionalFilter',
	function (test) {
		test.timeoutAfter(500)
		test.plan(1)

		const { authApi } = makeAuthApi()
		const capturedTerms: any[] = []
		const ds = {
			cohort: {
				termdb: {
					getAdditionalFilter: (_protected: any, terms: any) => {
						if (terms) capturedTerms.push(...terms)
						return null
					}
				}
			}
		}
		const q: any = {
			__protected__: { clientAuthResult: {}, ignoredTermIds: ['ignored-term-id'] }
		}
		const routeTwLst = [
			{ term: { id: 'included-term' } },
			{ term: { id: 'ignored-term-id' } } // this should be filtered out
		]

		authApi.mayAdjustFilter(q, ds as any, routeTwLst as any)

		test.equal(
			capturedTerms.length,
			1,
			'should filter out ignored term from routeTwLst before passing to getAdditionalFilter'
		)
		test.end()
	}
)

tape('AuthApi.mayAdjustFilter: throws when filter.type is not tvslst', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const { authApi } = makeAuthApi()
	const q: any = {
		__protected__: { clientAuthResult: {}, ignoredTermIds: [] },
		filter: { type: 'invalid-type', join: '', lst: [] }
	}
	const ds = { cohort: { termdb: { getAdditionalFilter: () => ({ type: 'tvslst' }) } } }

	try {
		authApi.mayAdjustFilter(q, ds as any, undefined)
		test.fail('should have thrown for invalid filter.type')
	} catch (e) {
		test.ok(String(e).includes("invalid q.filter.type != 'tvslst'"), 'should throw mentioning invalid filter type')
	}
	test.end()
})
