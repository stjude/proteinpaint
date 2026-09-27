import tape from 'tape'
import fs from 'fs'
import path from 'path'
import { getProtectedRoutes } from '@sjcrh/augen'
import { routeFiles } from '../app.routes.js'
import { protectedRoutes } from '../auth/protectedRoutes.ts'
import { getAuthApi } from '../auth.ts'

/*
	server/test/protectedRoutes.json is emitted by augen.setRoutes() when the server
	is launched in debugmode, and is git-tracked, so that removing a route-level auth middleware
	or renaming a protected endpoint without its middlewares will fail this test, unless
	the change to protectedRoutes.json is also committed and therefore visible in code review.
*/
const jsonFile = path.join(import.meta.dirname, '../../test/protectedRoutes.json')

tape('\n', function (test) {
	test.comment('-***- server/test/protectedRoutes.json specs -***-')
	test.end()
})

tape('protectedRoutes.json matches the route-level auth middlewares', async function (test) {
	const expected = JSON.parse(fs.readFileSync(jsonFile, { encoding: 'utf8' }))
	const routes = await Promise.all(routeFiles)
	const actual = getProtectedRoutes(routes)
	const hint = `, if intended, relaunch the server in debugmode to regenerate protectedRoutes.json and commit the change`

	for (const [endpoint, middlewares] of Object.entries(expected)) {
		if (!actual[endpoint]) {
			test.fail(`missing route-level middlewares for the protected endpoint='${endpoint}'` + hint)
			continue
		}
		test.deepEqual(actual[endpoint], middlewares, `should have the same middlewares for endpoint='${endpoint}'`)
	}
	for (const endpoint in actual) {
		if (!expected[endpoint]) test.fail(`endpoint='${endpoint}' is not in protectedRoutes.json` + hint)
	}
	test.end()
})

tape('protectedRoutes.json only lists known protectedRoutes middlewares', function (test) {
	const expected = JSON.parse(fs.readFileSync(jsonFile, { encoding: 'utf8' }))
	const knownNames = Object.keys(protectedRoutes)
	for (const [endpoint, middlewares] of Object.entries(expected)) {
		for (const name of middlewares as string[]) {
			test.ok(
				knownNames.includes(name),
				`should be a known protectedRoutes middleware name='${name}' for '${endpoint}'`
			)
		}
	}
	test.end()
})

tape('protectedRoutes middlewares have a protectedRoute property with their name', function (test) {
	for (const [name, middleware] of Object.entries(protectedRoutes)) {
		test.equal((middleware as any).protectedRoute, name, `should have protectedRoute='${name}'`)
		test.equal(middleware.name, name, `should have name='${name}'`)
		test.ok(Object.isFrozen(middleware), `should freeze the ${name} middleware`)
	}
	test.end()
})

tape(
	'protectedRoutes middlewares fail closed for an express app that was not set up with getAuthApi()',
	function (test) {
		for (const [name, middleware] of Object.entries(protectedRoutes)) {
			let nextCalled = false
			test.throws(
				() => middleware({ app: {}, query: {} }, {}, () => (nextCalled = true)),
				/authApi has not been set up for this app/,
				`should throw for an unregistered app in the ${name} middleware`
			)
			test.notOk(nextCalled, `should not call next() for an unregistered app in the ${name} middleware`)
		}
		test.end()
	}
)

tape('protectedRoutes middlewares use the authApi that was set up for the request app', async function (test) {
	const app: any = {}
	await getAuthApi(app, {}, { validatedCreds: {} } as any)
	for (const [name, middleware] of Object.entries(protectedRoutes)) {
		let nextCalled = false
		middleware({ app, query: {} }, {}, () => (nextCalled = true))
		test.ok(nextCalled, `should call next() from the open-access ${name} middleware of the registered app`)
	}
	test.end()
})
