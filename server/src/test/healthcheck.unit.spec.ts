import tape from 'tape'
import { validHealthCheckResponse } from '../../shared/checkers/transformed/index.ts'
import * as route from '../../routes/healthcheck'

/****************************************
 reusable constants and helper functions
/***************************************/

type AnyFunction = (res: any, req: any) => any

function getApp({ api }) {
	const app = {
		routes: {},
		get(path: string, handler: AnyFunction) {
			app.setRoute(path, handler, 'get')
		},
		post(path: string, handler: AnyFunction) {
			app.setRoute(path, handler, 'post')
		},
		all(path: string, handler: AnyFunction) {
			app.setRoute(path, handler, 'get')
			app.setRoute(path, handler, 'post')
		},
		setRoute(path: string, handler: AnyFunction, method) {
			if (!method) throw `missing route method`
			if (!app.routes[path]) app.routes[path] = {}
			app.routes[path][method] = handler
		}
	}
	for (const method in api.methods) {
		const m = api.methods[method]
		app[method](api.endpoint, m.init({ app, genomes: { hg38: {} } }))
	}
	return app
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- server/health specs -***-')
	test.end()
})

tape('healthcheck', async test => {
	const app = getApp(route)
	const req = {}
	const res = {
		send(r) {
			test.deepEqual(
				validHealthCheckResponse(r)?.errors,
				[],
				' response should have an empty array for type check errors'
			)
		}
	}
	const r = app.routes[route.api.endpoint]
	test.equal(typeof r?.get, 'function', 'should exist as a route')
	await r.get(req, res)
	test.end()
})
