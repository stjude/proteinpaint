import tape from 'tape'
import fs from 'fs'
import path from 'path'
import { getProtectedRoutes } from '@sjcrh/augen'
import { routeFiles } from '../app.routes.js'
import { protectedRoutes } from '../auth/protectedRoutes.ts'

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
