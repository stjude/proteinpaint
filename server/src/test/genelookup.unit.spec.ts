import tape from 'tape'
import { validGeneLookupResponse } from '../../shared/checkers/transformed/index.ts'
import * as route from '../../routes/genelookup'
import serverconfig from '../serverconfig'
import path from 'path'

/****************************************
 reusable constants and helper functions
/***************************************/

const genomefile = serverconfig.genomes.find(g => g.name == 'hg38-test').file
const genomefilepath = path.join(serverconfig.binpath, genomefile)
const genomes = {
	'hg38-test': __non_webpack_require__(genomefilepath)
}

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
		app[method](
			api.endpoint,
			m.init({
				app,
				genomes /*: { 
				hg38: {
					genomicNameRegexp: {
						test(){}
					},
					genedb: {
						getjsonbyname: {
							all(){}
						}
					}
				} 
			}*/
			})
		)
	}
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
	const app = getApp(route)
	const req = { query: { input: 'kras', genome: 'hg38' } }
	const res = {
		send(r) {
			// TODO: use the second test instead of first (to be replaced)
			test.deepEqual(
				validGeneLookupResponse(r),
				{ success: true, errors: [], data: { error: 'invalid genome name' } },
				' response should have an empty array for type check errors'
			)
			// test.deepEqual(
			// 	validGeneLookupResponse(r)?.errors,
			// 	[],
			// 	' response should have an empty array for type check errors'
			// )
		}
	}
	const r = app.routes[route.api.endpoint]
	test.equal(typeof r?.get, 'function', 'should exist as a route')
	await r.get(req, res)
	test.end()
})
