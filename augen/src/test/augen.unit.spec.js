import tape from 'tape'
import { testApi } from '#src/tester.ts'
import { existsSync, rmSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { setRoutes, getProtectedRoutes, emitProtectedRoutes } from '#src/augen.js'

const __dirname = import.meta.dirname.trim()
const wasCalledDirectly = process.argv[1]?.includes('augen.unit.spec')
// console.log(8, { wasCalledDirectly })

tape('setRoutes()', async test => {
	const message = `should load a toy app that uses setRoutes()`
	try {
		const { server } = await import('./toyApp/app.js')
		test.pass(message)
		server.close()
	} catch (e) {
		/* c8 ignore start */
		console.log(18, e)
		test.fail(message)
		/* c8 ignore stop */
	}
	test.end()
})

// a mock express app that records the handlers that are registered for each method and endpoint
function getMockApp() {
	const registered = {}
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) {
		app[method] = (endpoint, ...handlers) => (registered[`${method} ${endpoint}`] = handlers)
	}
	return { app, registered }
}

// calls the registered handlers in order the way express would, stopping when next() is not called
function runHandlers(handlers, calls) {
	const req = { query: {} }
	const res = {}
	let i = 0
	const next = () => {
		const handler = handlers[i++]
		if (handler) handler(req, res, next)
	}
	next()
	return calls
}

function getNamedMiddleware(name, calls, props = {}) {
	return Object.assign(function (req, res, next) {
		calls.push(name)
		next()
	}, props)
}

tape('setRoutes(): registers the method validator, then all route middlewares, then the handler', test => {
	const calls = []
	const payload = {
		init: () => () => calls.push('handler'),
		middleware: getNamedMiddleware('validator', calls),
		request: { typeId: 'any' },
		response: { typeId: 'any' }
	}
	const { app, registered } = getMockApp()
	setRoutes(
		app,
		[
			{
				api: {
					endpoint: 'protected',
					middlewares: [getNamedMiddleware('auth1', calls), getNamedMiddleware('auth2', calls)],
					methods: { get: payload, post: payload }
				}
			},
			{
				api: {
					endpoint: 'noValidator',
					middlewares: [getNamedMiddleware('auth1', calls)],
					methods: { get: { ...payload, middleware: undefined } }
				}
			},
			{ api: { endpoint: 'noMiddlewares', methods: { get: payload } } }
		],
		{ basepath: '/api' }
	)

	test.deepEqual(
		Object.keys(registered).sort(),
		['get /api/noMiddlewares', 'get /api/noValidator', 'get /api/protected', 'post /api/protected'],
		'should register every method of each endpoint under the basepath'
	)
	for (const key of ['get /api/protected', 'post /api/protected']) {
		test.equal(registered[key].length, 4, `should register 4 handlers for '${key}'`)
		calls.length = 0
		test.deepEqual(
			runHandlers(registered[key], calls),
			['validator', 'auth1', 'auth2', 'handler'],
			`should call the validator, then each route middleware in order, then the handler for '${key}'`
		)
	}
	calls.length = 0
	test.deepEqual(
		runHandlers(registered['get /api/noValidator'], calls),
		['auth1', 'handler'],
		'should call the route middlewares then the handler when there is no method validator'
	)
	calls.length = 0
	test.deepEqual(
		runHandlers(registered['get /api/noMiddlewares'], calls),
		['validator', 'handler'],
		'should call the validator then the handler when there are no route middlewares'
	)

	// a route middleware that does not call next() must prevent the handler from being called
	const blocked = []
	const { app: app2, registered: registered2 } = getMockApp()
	setRoutes(app2, [
		{
			api: {
				endpoint: 'blocked',
				middlewares: [() => blocked.push('auth')],
				methods: { get: { ...payload, init: () => () => blocked.push('handler') } }
			}
		}
	])
	runHandlers(registered2['get /blocked'], blocked)
	test.deepEqual(blocked, ['auth'], 'should not call the handler when a route middleware does not call next()')

	test.throws(
		() => setRoutes(getMockApp().app, [{ api: { endpoint: 'bad', middlewares: () => {}, methods: { get: payload } } }]),
		/middlewares must be an array/,
		'should throw when middlewares is not an array'
	)
	test.end()
})

tape('getProtectedRoutes(): only tracks the middlewares with a protectedRoute property', test => {
	const calls = []
	const payload = { init: () => () => {}, request: { typeId: 'any' }, response: { typeId: 'any' } }
	const routes = [
		{
			api: {
				endpoint: 'z/last',
				middlewares: [getNamedMiddleware('rateLimit', calls), getNamedMiddleware('a', calls, { protectedRoute: 'a' })],
				methods: { get: payload }
			}
		},
		{
			api: {
				endpoint: 'a/first',
				middlewares: [getNamedMiddleware('b', calls, { protectedRoute: 'b' })],
				methods: { get: payload }
			}
		},
		{
			api: {
				endpoint: 'notProtected',
				middlewares: [getNamedMiddleware('rateLimit', calls)],
				methods: { get: payload }
			}
		},
		{ api: { endpoint: 'noMiddlewares', methods: { get: payload } } }
	]
	const protectedRoutes = getProtectedRoutes(routes)
	test.deepEqual(protectedRoutes, { 'a/first': ['b'], 'z/last': ['a'] }, 'should only list the protectedRoute names')
	test.deepEqual(Object.keys(protectedRoutes), ['a/first', 'z/last'], 'should sort the endpoints')

	const dir = mkdtempSync(join(tmpdir(), 'augen-protectedRoutes-'))
	const file = join(dir, 'protectedRoutes.json')
	emitProtectedRoutes(routes, join(dir, 'missingDir/protectedRoutes.json'))
	test.notOk(existsSync(join(dir, 'missingDir')), 'should not emit when the directory does not exist')
	emitProtectedRoutes(routes, file)
	test.deepEqual(JSON.parse(readFileSync(file, 'utf8')), protectedRoutes, 'should emit the protected routes json')
	const { mtimeMs } = statSync(file)
	writeFileSync(file, readFileSync(file, 'utf8'))
	const rewrittenMtime = statSync(file).mtimeMs
	emitProtectedRoutes(routes, file)
	test.equal(statSync(file).mtimeMs, rewrittenMtime, 'should not rewrite the file when the content is unchanged')
	test.ok(mtimeMs, 'should have emitted a file')
	rmSync(dir, { recursive: true })
	test.end()
})
