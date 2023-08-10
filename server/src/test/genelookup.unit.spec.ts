import tape from 'tape'
import { validGeneLookupResponse } from '../../shared/checkers/transformed/index'
import { setRoute } from '#routes/genelookup'

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
	setHandler(app, { hg19: {} }, '')
	return app
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- server/genelookup specs -***-')
	test.end()
})

tape('genelookup', async test => {
	const app = getApp(setRoute)
	const req = { input: 'kras', genome: 'hg19' }
	const res = {
		send(r) {
			test.deepEqual(
				validGeneLookupResponse(r)?.errors,
				[],
				' response should have an empty array for type check errors'
			)
		}
	}
	test.equal(typeof app.routes['/genelookup']?.get, 'function', 'should exist as a route')
	await app.routes['/genelookup'].get(req, res)
	test.end()
})
