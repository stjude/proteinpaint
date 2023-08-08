import tape from 'tape'
import { validHealthCheckResponse } from '../../shared/checkers/transformed/index.ts'
import { setRoute } from '#routes/healthcheck'

/****************************************
 reusable constants and helper functions
/***************************************/

type AnyFunction = (res: any, req: any) => any

function getApp(setHandler) {
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
	setHandler(app, { hg38: {} }, '')
	return app
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- server/health specs -***-')
	test.end()
})

tape('health check', async test => {
	const app = getApp(setRoute)
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
	test.equal(typeof app.routes['/healthcheck']?.get, 'function', 'should exist as a route')
	await app.routes['/healthcheck'].get(req, res)
	test.end()
})
