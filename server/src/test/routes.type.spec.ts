import tape from 'tape'
import path from 'path'
import fs from 'fs'
import { initdb } from './genome.initdb.js'
import { init as mds3_init } from '../mds3.init.js'
import * as checkers from '../../shared/checkers/index.ts'
import serverconfig from '../serverconfig.js'

/****************************************
 reusable constants and helper functions
/***************************************/

const genomes = {
	// test genome js location can be hardcoded for testing
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore, not meant for tsc which already excludes spec files
	// in server/tsconfig.json, but for typia and typedoc to ignore type
	// check warning/errors when generating tester functions and documentation
	'hg38-test': __non_webpack_require__(path.join(import.meta.dirname, '../../server/genome/hg38.test.js'))
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

runTests()

async function runTests() {
	g.datasets = {}
	try {
		g.datasets.TermdbTest = await setDataset(g, {
			name: 'TermdbTest',
			jsfile: './dataset/termdb.test.js'
		})
	} catch (e) {
		console.log(`Error in setDataset(): `, e)
		process.exit(1)
	}

	const files = fs.readdirSync(path.join(serverconfig.binpath, '/routes')).filter(f => f.endsWith('.ts'))
	for (const f of files) {
		await testApi(f)
	}
}

// f: a filename under the server/routes dir
async function testApi(f) {
	const { api } = await import(
		/* webpackInclude: /\.(ts|js)$/ */
		/* webpackExclude: /\.md$/ */
		`../../routes/${f}`
	)
	tape('\n', function (test) {
		test.comment(`-***- server/${f} specs -***-`)
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
					query: x.request?.query || x.request?.body || {}
				}
				const res = {
					statusNum: 200,
					send(payload) {
						if (!payload) {
							test.fail('empty response payload for request: ')
							return
						}
						if (payload.error) {
							test.fail(payload?.error)
							return
						}
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

async function setDataset(g, d) {
	/*
	for each raw dataset
	*/
	const genomename = g.name
	if (!d.name) throw 'a nameless dataset from ' + genomename
	if (g.datasets[d.name]) throw genomename + ' has duplicating dataset name: ' + d.name
	if (!d.jsfile) throw 'jsfile not available for dataset ' + d.name + ' of ' + genomename

	/*
		When using a Docker container, the mounted app directory
		may have an optional dataset directory, which if present
		will be symlinked to the app directory and potentially override any
		similarly named dataset js file that are part of the standard
		Proteinpaint packaged files[] 
	*/
	const jsfile = path.join(process.cwd(), d.jsfile)
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore, not meant for tsc which already excludes spec files
	// in server/tsconfig.json, but for typia and typedoc to ignore type
	// check warning/errors when generating tester functions and documentation
	const _ds = __non_webpack_require__(jsfile)
	const ds = _ds.default || _ds

	ds.noHandleOnClient = d.noHandleOnClient
	ds.label = d.name
	ds.genomename = genomename
	g.datasets[ds.label] = ds

	if (ds.isMds3) {
		try {
			await mds3_init(ds, g, d, null)
			return ds
		} catch (e) {
			if (e instanceof Error && e.stack) console.log(e.stack)
			throw 'Error with mds3 dataset ' + ds.label + ': ' + e
		}
	}
}
