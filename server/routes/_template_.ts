// using snp types only as an example
import type { SnpRequest, SnpResponse, RouteApi } from '#types'
// imported payload is typed as RoutePayload
import { snpPayload } from '#types'

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun
	// - don't add 'Data' as response is assumed to be data
	// - don't prefix with `get`, such as `/getmyroute`, the method is already indicated via HTTP GET
	endpoint: '/myroute',
	methods: {
		get: {
			...snpPayload, // this would "spread"/copy-over payload key-values from snpPayload, such as {request: {typeId}, examples: []}
			init
		},
		post: {
			...snpPayload, // repeat for post method, since PP routes are mostly read-only and POST can handle bigger payloads
			init
		}
		// !!! DO NOT USE expressjs 'all' method shortcut !!!
		// it will initialize 20+ methods includng HEAD which can break expected HTTP response
	}
}

// init() is used to generate server route handler,
// augen.setRoutes() will use it to generate the second argument to expressjs method init,
// such as `app.get(api.endpoint, init({app, genomes}))`
function init({ genomes }) {
	return async function (req, res) {
		// use the colon syntax for clarity, the type is seen upfront instead of at the end
		const q: SnpRequest = req.query

		// can also use 'satisfies' keyword instead of colon syntax;
		// do not use 'as' keyword, which is less strict than 'satisfies'
		res.send({} satisfies SnpResponse)
		// or perhaps more commonly,
		// const result: SnpResponse = someFunction(q)
		// res.send(result)
	}
}
