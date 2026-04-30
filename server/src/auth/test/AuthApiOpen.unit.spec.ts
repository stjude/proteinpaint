import tape from 'tape'
import { AuthApiOpen } from '#src/auth/AuthApiOpen.ts'

/*************************
 reusable constants and helper functions
**************************/

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/AuthApiOpen -***-')
	test.end()
})

tape('AuthApiOpen: has expected interface properties', function (test) {
	test.timeoutAfter(500)

	const keys = Object.keys(AuthApiOpen).sort()
	test.deepEqual(
		keys,
		[
			'canDisplaySampleIds',
			'credEmbedders',
			'getDsAuth',
			'getHealth',
			'getNonsensitiveInfo',
			'getPayloadFromHeaderAuth',
			'getRequiredCredForDsEmbedder',
			'isUserLoggedIn',
			'mayAdjustFilter',
			'maySetAuthRoutes'
		],
		'should expose the expected AuthInterface methods and properties'
	)
	test.end()
})

tape('AuthApiOpen.credEmbedders: is an empty array', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	test.ok(Array.isArray(AuthApiOpen.credEmbedders), 'credEmbedders should be an array')
	test.equal(AuthApiOpen.credEmbedders.length, 0, 'credEmbedders should be empty for open access')
	test.end()
})

tape('AuthApiOpen.getDsAuth: returns empty array', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const result = AuthApiOpen.getDsAuth({} as any)
	test.deepEqual(result, [], 'getDsAuth should return an empty array')
	test.end()
})

tape('AuthApiOpen.getNonsensitiveInfo: returns no forbiddenRoutes', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const result = AuthApiOpen.getNonsensitiveInfo({} as any)
	test.deepEqual(result, { forbiddenRoutes: [] }, 'getNonsensitiveInfo should return empty forbiddenRoutes')
	test.end()
})

tape('AuthApiOpen.isUserLoggedIn: always returns true', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	test.equal(AuthApiOpen.isUserLoggedIn({} as any, null as any, null as any), true, 'should return true for any request')
	test.equal(AuthApiOpen.isUserLoggedIn({} as any, {} as any, []), true, 'should always return true regardless of arguments')
	test.end()
})

tape('AuthApiOpen.getRequiredCredForDsEmbedder: returns undefined', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const result = AuthApiOpen.getRequiredCredForDsEmbedder('anyDs', 'anyEmbedder')
	test.equal(result, undefined, 'should return undefined for any dslabel and embedder')
	test.end()
})

tape('AuthApiOpen.getPayloadFromHeaderAuth: returns empty object', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const result = AuthApiOpen.getPayloadFromHeaderAuth({} as any, '/some/route')
	test.deepEqual(result, {}, 'should return an empty object')
	test.end()
})

tape('AuthApiOpen.getHealth: returns undefined', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const result = AuthApiOpen.getHealth()
	test.equal(result, undefined, 'should return undefined')
	test.end()
})

tape('AuthApiOpen.canDisplaySampleIds: respects ds.cohort.termdb.displaySampleIds', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const dsWithFlag = { cohort: { termdb: { displaySampleIds: true } } }
	const dsWithoutFlag = { cohort: { termdb: {} } }
	const dsFalseFlag = { cohort: { termdb: { displaySampleIds: false } } }

	test.equal(AuthApiOpen.canDisplaySampleIds({} as any, dsWithFlag as any), true, 'should return true when displaySampleIds is truthy')
	test.equal(AuthApiOpen.canDisplaySampleIds({} as any, dsWithoutFlag as any), false, 'should return false when displaySampleIds is not set')
	test.equal(AuthApiOpen.canDisplaySampleIds({} as any, dsFalseFlag as any), false, 'should return false when displaySampleIds is false')
	test.end()
})

tape('AuthApiOpen.mayAdjustFilter: does not modify q.filter', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const q: any = { filter: { type: 'tvslst', join: '', lst: [] } }
	const qOriginal = JSON.parse(JSON.stringify(q))
	AuthApiOpen.mayAdjustFilter(q, null as any, null as any)
	test.deepEqual(q, qOriginal, 'should not modify q.filter')
	test.end()
})

tape('AuthApiOpen.maySetAuthRoutes: sets a global middleware that adds __protected__ to req.query', function (test) {
	test.timeoutAfter(500)
	test.plan(3)

	const registeredMiddlewares: any[] = []
	const mockApp: any = {
		use(handler: any) {
			registeredMiddlewares.push(handler)
		}
	}

	AuthApiOpen.maySetAuthRoutes(mockApp, {} as any, '', {} as any)

	test.equal(registeredMiddlewares.length, 1, 'should register exactly one middleware')

	// Simulate a request through the middleware
	const req: any = { query: {}, cookies: {} }
	const res: any = {}
	let nextCalled = false
	function next() { nextCalled = true }

	registeredMiddlewares[0](req, res, next)

	test.ok(req.query.__protected__, 'should add __protected__ to req.query')
	test.ok(nextCalled, 'should call next()')
	test.end()
})

tape('AuthApiOpen.maySetAuthRoutes: throws when q.sessionid already exists', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const registeredMiddlewares: any[] = []
	const mockApp: any = {
		use(handler: any) {
			registeredMiddlewares.push(handler)
		}
	}

	AuthApiOpen.maySetAuthRoutes(mockApp, {} as any, '', {} as any)

	const req: any = { query: { sessionid: 'existing-value' }, cookies: {} }
	const res: any = {}
	const next = () => {}

	try {
		registeredMiddlewares[0](req, res, next)
		test.fail('should have thrown when q.sessionid already exists')
	} catch (e) {
		test.ok(String(e).includes('q.sessionid already exists'), 'should throw mentioning q.sessionid already exists')
	}
	test.end()
})
