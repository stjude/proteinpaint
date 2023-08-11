import tape from 'tape'
import * as checkers from '../../shared/checkers/transformed/index.ts'
import serverconfig from '../serverconfig'
import path from 'path'
import fs from 'fs'

/****************************************
 reusable constants and helper functions
/***************************************/

const genomefile = serverconfig.genomes.find(g => g.name == 'hg38-test').file
const genomefilepath = path.join(serverconfig.binpath, genomefile)
const genomes = {
	'hg38-test':
		typeof __non_webpack_require__ === 'function' ? __non_webpack_require__(genomefilepath) : require(genomefilepath)
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
		tape(api.endpoint, async test => {
			const app = getApp({ api })
			const req = { query: { input: 'kras', genome: 'hg38' } }
			const res = {
				send(r) {
					// TODO: should use examples
					test.deepEqual(
						checkers[`valid${m.response.typeId}`](r)?.errors,
						[],
						' response should have an empty array for type check errors'
					)
				}
			}
			const r = app.routes[api.endpoint]
			test.equal(typeof r?.get, 'function', 'should exist as a route')
			await r.get(req, res)
			test.end()
		})
	}
}
