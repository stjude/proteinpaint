import tape from 'tape'
import * as checkers from '../../shared/checkers/transformed/index.ts'
import serverconfig from '../serverconfig'
import path from 'path'
import fs from 'fs'
import { initdb } from '../genome.initdb'

/****************************************
 reusable constants and helper functions
/***************************************/

const genomes = {
	// test genome js location can be hardcoded for testing
	'hg38-test': require('../../genome/hg38.test.js')
}
const g = genomes['hg38-test']
initdb(g)

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
		app[method](api.endpoint, m.init({ app, genomes }))
	}
	return app
}

/**************
 test sections
***************/

const files = fs.readdirSync(path.join(serverconfig.binpath, '/routes'))
for (const f of files) {
	const { api } = require(`../../routes/${f}`)

	tape('\n', function (test) {
		test.pass(`-***- server/${f} specs -***-`)
		test.end()
	})

	for (const method in api.methods) {
		const m = api.methods[method]
		const METHOD = method.toUpperCase()
		if (!m.examples) m.examples = [{ request: {}, response: {} }]

		for (const x of m.examples) {
			tape(`${api.endpoint} ${METHOD}`, async test => {
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
						test.deepEqual(
							checkers[`valid${m.response.typeId}`](payload)?.errors,
							[],
							'validation should have an empty array for type check errors'
						)
					},
					status(num) {
						// expect this to be called before send()
						res.statusNum = num
					}
				}
				const route = app.routes[api.endpoint]
				test.equal(typeof route?.get, 'function', 'should exist as a route')
				await route.get(req, res)
				test.end()
			})
		}
	}
}
