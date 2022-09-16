const tape = require('tape')
const auth = require('../auth')
const jsonwebtoken = require('jsonwebtoken')
const serverconfig = require('../serverconfig')

/*************************
 reusable constants and helper functions
**************************/

const cachedir = serverconfig.cachedir
const headerKey = 'x-ds-token'
const secret = 'abc123'
const time = Math.floor(Date.now() / 1000)
const validToken = jsonwebtoken.sign({ iat: time, exp: time + 300, datasets: ['ds0'] }, secret)

function appInit() {
	const app = {
		routes: {},
		middlewares: {},
		setRoute(method, route, handler) {
			if (!app.routes[route]) app.routes[route] = {}
			app.routes[route][method] = handler
		},
		get(route, handler) {
			app.setRoute('get', route, handler)
		},
		post(route, handler) {
			app.setRoute('post', route, handler)
		},
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

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- server/auth specs -***-')
	test.end()
})

tape(`initialization`, async test => {
	const app = appInit()
	await auth.maySetAuthRoutes(app)
	const middlewares = Object.keys(app.middlewares)
	test.deepEqual(['*'], middlewares, 'should set a global middleware')
	const routes = Object.keys(app.routes)
	routes.sort()
	test.deepEqual(['/dslogin', '/jwt-status'], routes, 'should set the expected routes')
	test.end()
})

tape(`a valid request`, async test => {
	test.timeoutAfter(500)
	test.plan(2)

	const app = appInit()
	const serverconfig = {
		dsCredentials: {
			ds0: {
				embedders: {
					localhost: {
						secret
					}
				},
				headerKey
			}
		},
		cachedir
	}

	await auth.maySetAuthRoutes(app, '', serverconfig) //; console.log(app.routes)
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: validToken
			}
		}
		const res = {
			send(data) {
				test.deepEqual({ status: 'ok' }, data, 'should respond ok')
			},
			header(key, val) {
				test.equal(key, 'Set-cookie', 'should set a session cookie')
			},
			headers: {}
		}
		await app.routes['/jwt-status'].post(req, res)
	}

	test.end()
})

tape(`invalid embedder`, async test => {
	test.timeoutAfter(500)
	test.plan(2)

	const app = appInit()
	const headerKey = 'x-ds-token'
	const secret = 'abc123'
	const serverconfig = {
		dsCredentials: {
			ds0: {
				embedders: {
					localhost: {
						secret
					}
				},
				headerKey
			}
		},
		cachedir
	}

	await auth.maySetAuthRoutes(app, '', serverconfig) //; console.log(app.routes)
	{
		const req = {
			query: { embedder: 'unknown-host', dslabel: 'ds0' },
			headers: {
				[headerKey]: validToken
			}
		}
		const res = {
			send(data) {
				test.deepEqual(
					data,
					{ error: `unknown q.embedder='${req.query.embedder}'` },
					'should send an unknown embedder error'
				)
			},
			header(key, val) {
				test.fail('should NOT set a session cookie')
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
	test.plan(2)

	const app = appInit()
	const headerKey = 'x-ds-token'
	const secret = 'abc123'
	const serverconfig = {
		dsCredentials: {
			ds0: {
				embedders: {
					localhost: {
						secret
					}
				},
				headerKey
			}
		},
		cachedir
	}

	await auth.maySetAuthRoutes(app, '', serverconfig) //; console.log(app.routes)
	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: jsonwebtoken.sign({ iat: time, exp: time + 300, datasets: ['NOT-ds0'] }, secret)
			}
		}
		const res = {
			send(data) {
				test.deepEqual(
					data,
					{ error: `Please request access for these dataset(s): ["ds0"]. ` },
					'should send instructions to request data access'
				)
			},
			header(key, val) {
				test.fail('should NOT set a session cookie')
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
	test.plan(6)

	const app = appInit()
	const headerKey = 'x-ds-token'
	const secret = 'abc123'
	const serverconfig = {
		dsCredentials: {
			ds0: {
				embedders: {
					localhost: {
						secret
					}
				},
				headerKey
			}
		},
		cachedir
	}

	await auth.maySetAuthRoutes(app, '', serverconfig) //; console.log(app.routes)

	{
		const req = {
			query: { embedder: 'localhost', dslabel: 'ds0' },
			headers: {
				[headerKey]: 'invalid-token-abccccc'
			}
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
				test.fail('should NOT set a session cookie')
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
			}
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
				test.fail('should NOT set a session cookie')
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
			}
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
				test.fail('should NOT set a session cookie')
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
