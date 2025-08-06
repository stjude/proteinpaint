import tape from 'tape'
import { authApi } from '../auth.js'
import jsonwebtoken from 'jsonwebtoken'
import serverconfig from '../serverconfig.js'

/*************************
 reusable constants and helper functions
**************************/

const cachedir = serverconfig.cachedir
const debugmode = true
const headerKey = 'x-ds-token'
const secret = 'abc123' // pragma: allowlist secret
const time = Math.floor(Date.now() / 1000)
const validToken = jsonwebtoken.sign(
	{ iat: time, exp: time + 300, datasets: ['ds0'], ip: '127.0.0.1', email: 'user@test.abc' },
	secret
)
const secrets = {
	dataDownloadDemo: {
		type: 'jwt',
		secret,
		dsnames: [{ id: 'ds0', label: 'Dataset 0' }]
	}
}

function appInit() {
	// mock the express router api
	const app = {
		doNotFreezeAuthApi: true,
		routes: {},
		middlewares: {},
		setRoute(method, route, handler) {
			if (!app.routes[route]) app.routes[route] = {}
			app.routes[route][method] = handler
		},
		/* c8 ignore start */
		get(route, handler) {
			app.setRoute('get', route, handler)
		},
		post(route, handler) {
			app.setRoute('post', route, handler)
		},
		/* c8 ignore stop */
		all(route, handler) {
			app.setRoute('get', route, handler)
			app.setRoute('post', route, handler)
		},
		use() {
			const handler = arguments[1] || arguments[0]
			if (arguments.length == 1) app.middlewares['*'] = handler
			else app.middlewares[arguments[0]] = handler
		}
	}

	return app
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- server/auth specs -***-')
	test.end()
})

tape(`initialization, empty credentials`, async test => {
	const app = appInit()
	await authApi.maySetAuthRoutes(app, {}, '', { debugmode, cachedir })
	const middlewares = Object.keys(app.middlewares)
	test.deepEqual(middlewares, [], 'should NOT set a global middleware when there are NO dsCredentials in serverconfig')
	const routes = Object.keys(app.routes)
	routes.sort()
	test.deepEqual(routes, [], 'should NOT set the expected routes when there are NO dsCredentials in serverconfig')

	test.deepEqual(
		Object.keys(authApi).sort(),
		[
			'canDisplaySampleIds',
			'credEmbedders',
			'getDsAuth',
			'getHealth',
			'getJwtPayload',
			'getNonsensitiveInfo',
			'getPayloadFromHeaderAuth',
			'getRequiredCredForDsEmbedder',
			'mayAdjustFilter',
			'maySetAuthRoutes',
			'userCanAccess'
		],
		'should set the expected methods with an empty dsCredentials'
	)

	const ds = { cohort: { termdb: { displaySampleIds: () => true } } }
	const req = {}
	test.equal(
		authApi.canDisplaySampleIds(req, ds),
		true,
		'should support the cohort.termdb.displaySampleIds() option in the default canDisplaySampleIds()'
	)
	test.equal(authApi.userCanAccess(req, ds), true, 'should allow use access by default when there are no credentials')
	test.deepEqual(
		authApi.getNonsensitiveInfo(),
		{ forbiddenRoutes: [] },
		'should have no forbiddenRoutes when there are no credentials'
	)
	const q0 = { filter: { test: 'abc123' } }
	const q1 = structuredClone(q0)
	authApi.mayAdjustFilter(q1)
	test.deepEqual(q1, q0, 'should not change q.filter using the default authApi.mayAdjustFilter()')
	test.deepEqual(
		[
			authApi.getDsAuth(),
			authApi.getRequiredCredForDsEmbedder(),
			authApi.getPayloadFromHeaderAuth(),
			authApi.getHealth()
		],
		[[], undefined, {}, undefined],
		'should get empty values from other default authApi methods'
	)

	delete ds.cohort.termdb.displaySampleIds
	test.equal(
		authApi.canDisplaySampleIds(req, ds),
		false,
		'should default to not allowing the display of sample IDs if there is no ds.cohort.termdb.canDisplaySampleIds()'
	)

	test.end()
})

tape(`initialization, non-empty credentials`, async test => {
	{
		const app = appInit()
		await authApi.maySetAuthRoutes(app, {}, '', { debugmode, cachedir, dsCredentials: {}, secrets })
		const middlewares = Object.keys(app.middlewares)
		test.deepEqual(middlewares, [], 'should NOT set a global middleware when dsCredentials is empty')
		const routes = Object.keys(app.routes)
		routes.sort()
		test.deepEqual(routes, [], 'should NOT set the expected routes when dsCredentials is empty')
	}

	{
		const app = appInit()
		const dsCredentials = {
			testds: {
				'*': {
					'*': {
						type: 'basic',
						password: '...'
					}
				}
			}
		}
		await authApi.maySetAuthRoutes(app, {}, '', { debugmode, cachedir, dsCredentials, secrets })
		const middlewares = Object.keys(app.middlewares)
		test.deepEqual(
			middlewares,
			['*'],
			'should set a global middleware when there is a non-empty dsCredentials entry in serverconfig'
		)
		const routes = Object.keys(app.routes)
		routes.sort()
		test.deepEqual(
			routes,
			['/authorizedActions', '/dslogin', '/dslogout', '/jwt-status'],
			'should set the expected routes when there is a non-empty dsCredentials entry in serverconfig'
		)
	}

	{
		const app = appInit()
		const dsCredentials = {
			testds: {
				'*': {
					'*': {
						type: 'basic',
						password: '...'
					}
				}
			}
		}
		await authApi.maySetAuthRoutes(app, {}, '', { debugmode, dsCredentials, cachedir })
		test.deepEqual(
			Object.keys(authApi).sort(),
			[
				'canDisplaySampleIds',
				'credEmbedders',
				'getDsAuth',
				'getHealth',
				'getJwtPayload',
				'getNonsensitiveInfo',
				'getPayloadFromHeaderAuth',
				'getRequiredCredForDsEmbedder',
				'mayAdjustFilter',
				'maySetAuthRoutes',
				'userCanAccess'
			],
			'should set the expected methods with a non-empty dsCredentials'
		)
		test.deepEqual(
			authApi.getDsAuth({ query: { embedder: 'localhost' } }),
			[{ dslabel: 'testds', route: '/**', type: 'basic', headerKey: 'x-ds-access-token', insession: false }],
			'should return all dslabels that require authorization for a given embedder'
		)

		const req = { query: { dslabel: 'no-cred-entry', embedder: 'localhost' } }
		test.deepEqual(
			authApi.getNonsensitiveInfo(req),
			{ forbiddenRoutes: [], clientAuthResult: {} },
			'should return open-access forbidden routes for ds embedder with empty dsCredentials'
		)
		test.deepEqual(
			authApi.getRequiredCredForDsEmbedder(req.query.dslabel, req.query.embedder),
			undefined,
			'should return open-access getRequiredCredForDsEmbedder with an empty dsCredentials'
		)
		test.deepEqual(
			authApi.userCanAccess(req),
			true,
			'should return open-access userCanAccess with an empty dsCredentials'
		)
	}

	test.end()
})

tape('legacy reshape', async test => {
	test.timeoutAfter(500)
	test.plan(1)

	const app = appInit()
	const dsCredentials = {
		ds0: {
			type: 'jwt',
			embedders: {
				localhost: {
					secret,
					dsnames: [{ id: 'ds0', label: 'Dataset 0' }]
				}
			},
			headerKey
		},
		ds1: {
			type: 'login',
			password: '...'
		}
	}
	const serverconfig = {
		debugmode,
		dsCredentials,
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig)
	test.deepEqual(
		JSON.parse(JSON.stringify(dsCredentials)),
		{
			ds0: {
				termdb: {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }],
						headerKey: 'x-ds-token',
						dslabel: 'ds0',
						route: 'termdb',
						authRoute: '/jwt-status',
						cookieId: 'x-ds-token'
					}
				}
			},
			ds1: {
				'/**': {
					'*': {
						type: 'basic',
						password: '...',
						secret: '...',
						dslabel: 'ds1',
						route: '/**',
						authRoute: '/dslogin',
						cookieId: 'ds1-/**-*-Id',
						headerKey: 'x-ds-access-token'
					}
				}
			}
		},
		`should transform a legacy dsCredentials format to the current shape`
	)
})

tape(`auth methods`, async test => {
	test.timeoutAfter(500)
	test.plan(5)

	const app = appInit()
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds100: {
				termdb: {
					localhost: {
						type: 'jwt',
						secret
					}
				},
				burden: {
					notlocalhost: {
						type: 'basic',
						password: '...'
					},
					'*': {
						type: 'forbidden'
					}
				}
			}
		},
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig)

	const req0 = { query: { embedder: 'localhost', dslabel: 'ds100' }, get: () => 'localhost' }
	test.deepEqual(
		authApi.getDsAuth(req0),
		[
			{ dslabel: 'ds100', route: 'termdb', type: 'jwt', headerKey: 'x-ds-access-token', insession: undefined },
			{ dslabel: 'ds100', route: 'burden', type: 'forbidden', headerKey: undefined, insession: false }
		],
		`should return the expected dsAuth array for a termdb-specified embedder`
	)

	const req1 = { query: { embedder: 'some.domain', dslabel: 'ds100' }, get: () => 'localhost' }
	test.deepEqual(
		authApi.getDsAuth(req1),
		[{ dslabel: 'ds100', route: 'burden', type: 'forbidden', headerKey: undefined, insession: false }],
		`should return the expected dsAuth array for a specified embedder`
	)
	test.deepEqual(
		authApi.getNonsensitiveInfo(req1),
		{ forbiddenRoutes: ['burden'], clientAuthResult: undefined },
		`should return the expected forbidden routes for a wildcard embedder with cred.type='forbidden'`
	)

	const req2 = { query: { embedder: 'notlocalhost', dslabel: 'ds100' }, get: () => 'localhost' }
	test.deepEqual(
		authApi.getNonsensitiveInfo(req2),
		{ forbiddenRoutes: [], clientAuthResult: undefined },
		`should return the expected forbidden routes for a non-wildcard embedder`
	)
	test.deepEqual(
		authApi.userCanAccess({ query: { embedder: 'localhost' } }, { label: 'ds100' }),
		true,
		`should return false for userCanAccess() for a non-logged in user`
	)
})

tape(`a valid request`, async test => {
	test.timeoutAfter(500)
	test.plan(2)

	const app = appInit()
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }]
					}
				}
			}
		},
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig) //; console.log(app.routes)
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				'x-ds-access-token': validToken
			},
			ip: '127.0.0.1',
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				test.deepEqual(data.status, 'ok', 'should respond ok')
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should set a session cookie')
			},
			status(num) {
				test.fail(`should not set a status (${num})`)
			},
			headers: {}
		}
		await app.routes['/jwt-status'].post(req, res)
	}
})

tape(`mismatched ip address in /jwt-status`, async test => {
	test.timeoutAfter(500)
	test.plan(4)

	const app = appInit()
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }],
						headerKey
					}
				}
			}
		},
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig) //; console.log(app.routes)
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: validToken
			},
			ip: 'invalid-127.0.0.1',
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				test.deepEqual(
					data,
					{ error: 'Your connection has changed, please refresh your page or sign in again.' },
					'should detect mismatched IP address on jwt-status check'
				)
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should clear session cookie on unsuccessful login')
				test.true(val.toLowerCase().includes('max-age=0'), 'should cause a session cookie to expire')
			},
			status(num) {
				test.equal(num, 401, 'should set a 401 status')
			},
			headers: {}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	test.end()
})

tape(`invalid embedder`, async test => {
	test.timeoutAfter(500)
	test.plan(4)

	const app = appInit()
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }],
						headerKey
					},
					'*': {
						type: 'jwt'
					}
				}
			}
		},
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig) //; console.log(308, app.routes)

	{
		const req = {
			query: { embedder: 'unknown-host', dslabel: 'ds0' },
			headers: {
				[headerKey]: validToken
			},
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				test.deepEqual(
					data,
					{ status: 'error', error: 'no credentials set up for this embedder', code: 403 },
					'should send an unknown embedder error'
				)
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should clear session cookie on unsuccessful login')
				test.true(val.toLowerCase().includes('max-age=0'), 'should cause a session cookie to expire')
			},
			headers: {},
			status(num) {
				test.equal(num, 401, 'should set a 401 status for an unknown embedder')
			}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	const middlewares = Object.keys(app.middlewares)
	test.end()
})

tape(`invalid dataset access`, async test => {
	test.timeoutAfter(500)
	test.plan(4)

	const app = appInit()
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }],
						headerKey
					}
				}
			}
		},
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig)
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: jsonwebtoken.sign({ iat: time, exp: time + 300, datasets: ['NOT-ds0'] }, secret)
			},
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				test.deepEqual(
					data,
					{ error: `Missing access`, linkKey: 'ds0' },
					'should send instructions to request data access'
				)
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should clear session cookie on unsuccessful login')
				test.true(val.toLowerCase().includes('max-age=0'), 'should cause a session cookie to expire')
			},
			headers: {},
			status(num) {
				test.equal(num, 401, 'should set a 401 status for missing data access')
			}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	const middlewares = Object.keys(app.middlewares)
	test.end()
})

tape(`invalid jwt`, async test => {
	test.timeoutAfter(500)
	test.plan(12)

	const app = appInit()
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }],
						headerKey
					}
				}
			}
		},
		cachedir
	}

	await authApi.maySetAuthRoutes(app, {}, '', serverconfig) //; console.log(app.routes)

	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: 'invalid-token-abccccc'
			},
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				test.deepEqual(
					JSON.parse(JSON.stringify(data.error)),
					{ name: 'JsonWebTokenError', message: 'jwt malformed' },
					'should send a malformed JWT error'
				)
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should clear session cookie on unsuccessful login')
				test.true(val.toLowerCase().includes('max-age=0'), 'should cause a session cookie to expire')
			},
			headers: {},
			status(num) {
				test.equal(num, 401, 'should set a 401 status for a malformed jwt')
			}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: jsonwebtoken.sign({ iat: time, exp: time + 300, datasets: ['ds0'] }, 'wrong-secret')
			},
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				test.deepEqual(
					JSON.parse(JSON.stringify(data.error)),
					{ name: 'JsonWebTokenError', message: 'invalid signature' },
					'should send an invalid signature error'
				)
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should clear session cookie on unsuccessful login')
				test.true(val.toLowerCase().includes('max-age=0'), 'should cause a session cookie to expire')
			},
			headers: {},
			status(num) {
				test.equal(num, 401, 'should set a 401 status for an invalid signature')
			}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: jsonwebtoken.sign({ iat: time, exp: time - 1, datasets: ['ds0'] }, secret)
			},
			path: '/jwt-status'
		}
		const res = {
			send(data) {
				if (data.error) delete data.error.expiredAt
				test.deepEqual(
					JSON.parse(JSON.stringify(data.error)),
					{ name: 'TokenExpiredError', message: 'jwt expired' },
					'should send an expired JWT error'
				)
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should clear session cookie on unsuccessful login')
				test.true(val.toLowerCase().includes('max-age=0'), 'should cause a session cookie to expire')
			},
			headers: {},
			status(num) {
				test.equal(num, 401, 'should set a 401 status for an expired jwt')
			}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	const middlewares = Object.keys(app.middlewares)
	test.end()
})

tape(`session handling by the middleware`, async test => {
	test.timeoutAfter(1000)
	test.plan(5)

	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				termdb: {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }],
						headerKey
					}
				}
			}
		},
		cachedir
	}

	const app = appInit()
	await authApi.maySetAuthRoutes(app, {}, '', serverconfig)
	{
		const message = 'should call the next function on a non-protected route'
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: validToken
			},
			path: '/non-protected',
			cookies: {},
			get() {}
		}
		const res = {
			status(num) {
				test.equal(num, 401, 'should set a 401 status for an expired jwt')
			},
			send(data) {
				if (data.error) test.fail(message + ': ' + data.error)
				else test.pass(message)
			}
		}
		function next() {
			test.pass(message)
		}

		await app.middlewares['*'](req, res, next)
		await sleep(100)
	}

	let sessionId
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
			headers: {
				[headerKey]: validToken
			},
			path: '/jwt-status',
			email: 'user@test.abc',
			ip: '127.0.0.1'
		}
		//let sessionId
		const res = {
			status(num) {
				test.fail(`should set a ${num} status for a valid jwt`)
			},
			send(data) {
				test.deepEqual(data.status, 'ok', 'should respond ok on a valid jwt-status login')
			},
			header(key, val) {
				test.equal(key, 'Set-Cookie', 'should set a session cookie on a valid jwt-status login')
				sessionId = val.split(';')[0].split('=')[1]
			},
			headers: {}
		}
		console.log('triggering jwt-status post')
		app.routes['/jwt-status'].post(req, res)
		// Why would a /jwt-status need to call the next function?????
		// async function next() {
		// 	test.pass('should call the next() function for jwt-login'); console.log(572)
		// }
		//await app.middlewares['*'](req, res, next)
		await sleep(100)

		/*** valid session ***/
		const req1 = {
			query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
			headers: {
				[headerKey]: validToken
			},
			path: '/termdb',
			cookies: {
				[headerKey]: sessionId
			},
			ip: '127.0.0.1'
		}

		const message1 = 'should call the next function on a valid session'
		const res1 = {
			send(data) {
				if (data.error) test.fail(message1 + ': ' + data.error)
			},
			status() {}
		}
		function next1() {
			test.pass(message1)
		}
		await app.middlewares['*'](req1, res1, next1)
		await sleep(100)

		// **** invalid session id ***/
		const req2 = {
			query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
			headers: {
				[headerKey]: validToken
			},
			path: '/termdb',
			cookies: {
				[headerKey]: 'Invalid-Session-Id'
			}
		}
		const res2 = {
			send(data) {
				if (data.error) delete data.error.expiredAt
				test.deepEqual(
					data,
					{ error: `unestablished or expired browser session` },
					'should send an invalid session error'
				)
			},
			header(key, val) {
				test.fail('should NOT set a session cookie')
			},
			headers: {}
		}
		function next2() {
			test.fail('should NOT call the next function on an invalid session')
		}

		/*** invalid ip address ****/
		const req3 = {
			query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
			headers: {
				[headerKey]: validToken
			},
			path: '/termdb',
			cookies: {
				[headerKey]: sessionId
			},
			ip: '127.0.0.x'
		}
		const res3 = {
			send(data) {
				if (data.error) delete data.error.expiredAt
				test.deepEqual(
					data,
					{ error: `Your connection has changed, please refresh your page or sign in again.` },
					'should send a changed connection message'
				)
			},
			header(key, val) {
				test.fail('should NOT set a session cookie')
			},
			headers: {}
		}
		function next3() {
			test.fail('should NOT call the next function on an invalid session')
		}

		await app.middlewares['*'](req3, res3, next3)
	}
})

tape(`/dslogin`, async test => {
	test.timeoutAfter(400)
	test.plan(10)

	const password = '...' /* pragma: allowlist secret */
	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					'*': {
						type: 'basic',
						password,
						secret
					}
				}
			}
		},
		cachedir
	}

	const app = appInit()
	await authApi.maySetAuthRoutes(app, {}, '', serverconfig)

	let cookie
	/*** valid /dslogin request ***/
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
			headers: {
				authorization: 'Basic ' + Buffer.from(password).toString('base64')
			},
			method: 'POST',
			path: '/dslogin',
			ip: '127.0.0.1'
		}

		let jwt
		const res = {
			send(data) {
				if (data.error) test.fail('should not have an error on a valid /dslogin request')
				if (data.jwt) {
					test.equal(typeof data.jwt, 'string', 'should respond with a string jwt')
					const minChars = 100
					test.true(data.jwt?.length > minChars, `should have a jwt string with >${minChars} characters`)
					jwt = data.jwt
					delete data.jwt
				}
				test.deepEqual(
					data,
					{
						status: 'ok',
						route: '/**'
					},
					`should have the expected response payload`
				)
			},
			header(key, val) {
				test.true(
					key.toLowerCase() == 'set-cookie' && val.toLowerCase().includes('httponly'),
					'should respond with an http-only header cookie on a valid /dslogin request'
				)
				cookie = val.split(';')[0].trim()
			},
			status(code) {
				test.fail(`should not set the status code='' on a valid /dslogin request [code=${code}]`)
			},
			headers: {}
		}

		await app.routes['/dslogin'].post(req, res)

		{
			// middleware test when there is a valid logged-in user via /dslogin
			const [cookieId, cookieVal] = cookie.split('=').map(str => str.trim())
			const req = {
				query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
				cookies: {
					[cookieId]: cookieVal
				},
				headers: {
					cookie,
					authorization: 'Bearer ' + Buffer.from(jwt).toString('base64')
				},
				path: '/termdb',
				ip: '127.0.0.1'
			}

			const res = {
				send(data) {
					test.equal(data.error, undefined, `should not respond with an error for a logged in user`)
				},
				status(code) {
					test.fail(`should not set a response status code for logged in user`)
				}
			}

			function next() {
				test.pass(`the middleware should call next() for a logged in user`)
			}

			await app.middlewares['*'](req, res, next)
		}
	}

	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
			headers: {
				[headerKey]: validToken,
				authorization: 'Basic ' + Buffer.from('wrong-password').toString('base64')
			},
			method: 'POST',
			path: '/dslogin',
			ip: '127.0.0.1'
		}

		const res = {
			send(data) {
				if (data.error) test.pass('should have an error on an invalid /dslogin request')
				test.equal(typeof data.jwt, 'undefined', 'should respond without a jwt')
			},
			header(key, val) {
				test.fail('should NOT set a session cookie')
			},
			status(code) {
				test.equal(code, 401, 'should respond with the expected header status code for an invalid /dslogin request')
			},
			headers: {}
		}

		await app.routes['/dslogin'].post(req, res)

		{
			// middleware test when there is an invalid logged-in user via /dslogin
			const [cookieId, cookieVal] = cookie.split('=').map(str => str.trim())
			const req = {
				query: { embedder: 'localhost', dslabel: 'ds0', for: 'matrix' },
				cookies: {
					[cookieId]: 'invalid-cookie-value'
				},
				headers: {
					cookie,
					authorization: 'Bearer ' + Buffer.from('invalid-jwt').toString('base64')
				},
				path: '/termdb',
				ip: '127.0.0.1'
			}

			const res = {
				send(data) {
					test.equal(
						data.error,
						'unestablished or expired browser session',
						`should respond with an error for a non-logged in user`
					)
				},
				status(code) {
					test.equal(code, 401, `should set the expected response status code for non-logged in user`)
				}
			}

			/* c8 ignore next */
			function next() {
				test.fail(`the middleware should NOT call next() for a non-logged in user`)
			}
			/* c8 ignore next */

			await app.middlewares['*'](req, res, next)
		}
	}
})

tape(`req.query.filter, __protected__`, async test => {
	test.timeoutAfter(500)
	test.plan(2)

	const app = appInit()

	const serverconfig = {
		debugmode,
		dsCredentials: {
			ds0: {
				'*': {
					localhost: {
						type: 'jwt',
						secret,
						dsnames: [{ id: 'ds0', label: 'Dataset 0' }]
					}
				}
			}
		},
		cachedir
	}

	const tvslst = { type: 'tvslst', lst: [{ type: 'tvs', tvs: { term: {}, values: {} } }] }

	const genomes = {
		test: {
			datasets: {
				ds0: {
					cohort: {
						termdb: {
							getAdditionalFilter() {
								return structuredClone(tvslst)
							}
						}
					}
				}
			}
		}
	}

	await authApi.maySetAuthRoutes(app, genomes, '', serverconfig)
	authApi.getNonsensitiveInfo = () => {
		return { clientAuthResult: {} }
	}

	{
		const req = {
			query: { embedder: 'localhost', genome: 'test', dslabel: 'ds0' },
			headers: {
				'x-ds-access-token': validToken
			},
			ip: '127.0.0.1',
			path: '/abc',
			cookies: {
				sessionid: 'xyz'
			}
		}
		const res = {
			send(data) {},
			/* c8 ignore start */
			header(key, val) {},
			/* c8 ignore stop */
			status(num) {},
			headers: {}
		}

		app.middlewares['*'](req, res, /* c8 ignore next */ () => {})
		// since req.filter is empty, it will be replaced (not joined) with a term-level auth filter
		const expectedFilter = { ...tvslst, tag: 'termLevelAuthFilter' }
		test.deepEqual(req.query.filter, expectedFilter, 'should set up req.query.filter')

		test.deepEqual(
			req.query.__protected__,
			{
				ignoredTermIds: [],
				sessionid: 'xyz',
				clientAuthResult: {},
				userCanAccessDs: false
			},
			'should set up req.query.__protected__'
		)
	}
})
