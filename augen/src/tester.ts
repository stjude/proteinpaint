import tape from 'tape'

/****************************************
 reusable constants and helper functions
/***************************************/

type AnyFunction = (res: any, req: any) => any

function getApp({ api }, getHandlerInitArg = null) {
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
		app[method](api.endpoint, m.init(getHandlerInitArg))
	}
	return app
}

/**************
 test sections
***************/

// f: a filename under the server/routes dir
export function testApi(route, f, checkers) {
	const { api } = route

	tape('\n', function (test) {
		test.comment(`-***- ${f} specs -***-`)
		test.end()
	})

	for (const method in api.methods) {
		console.log(method)
		const m = api.methods[method]
		const METHOD = method.toUpperCase()
		if (!m.examples) m.examples = [{ request: {}, response: {} }]

		for (const x of m.examples) {
			tape(`${api.endpoint} ${METHOD}`, test => {
				if (m.alternativeFor) {
					console.log(`${METHOD} method tested previously as '${m.alternativeFor.toUpperCase()}'`)
					test.end()
					return
				}
				const app = getApp({ api })
				const req = {
					query: x.request?.body || {}
				}
				const res = {
					statusNum: 200,
					send(payload) {
						if (x.response.header?.status) {
							test.equal(res.statusNum, x.response.header?.status, `response status should match the example`)
						}
						if (x.response.body) {
							test.deepEqual(payload, x.response.body, `response body should match the example`)
						}

						if (checkers) {
							test.deepEqual(
								checkers[`valid${m.response.typeId}`](payload)?.errors,
								[],
								'validation should have an empty array for type check errors'
							)
						}
					},
					status(num) {
						// expect this to be called before send()
						res.statusNum = num
					}
				}
				const route = app.routes[api.endpoint]
				test.equal(typeof route?.get, 'function', 'should exist as a route')
				route.get(req, res)
				test.end()
			})
		}
	}
}
