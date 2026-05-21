/*
	IMPORTANT: See routes/README.md for instructions on
	importing route files in `src/app.routes.ts`.
*/

// using snp types only as an example
import type { SnpRequest, SnpResponse, RouteApi, RoutePayload } from '#types'
import { validGenome, validString, validStringArr, validBoolean } from './common.ts'
// imported payload is typed as RoutePayload

// Note that snpPayload has the RoutePayload type, and should really have
// checker validation functions even though they are currently optional.
// See validTermdbSampleScatterRequest() in server/routes/checkers/termdb.sampleScatter.ts
// for an example.

const payload: RoutePayload = {
	init,
	request: {
		typeId: 'SnpRequest',
		checker
	},
	response: {
		typeId: 'SnpResponse'
	}
}

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun
	// - don't add 'Data' as response is assumed to be data
	// - don't prefix with `get`, such as `/getmyroute`, the method is already indicated via HTTP GET
	endpoint: '/myroute',
	methods: {
		get: payload,
		// repeat for post method, since PP routes are mostly read-only and POST can handle bigger payloads
		post: payload
		// !!! DO NOT USE expressjs 'all' method shortcut !!!
		// it will initialize 20+ methods includng HEAD which can break expected HTTP response
	}
}

function checker(input): SnpRequest {
	const genome = validGenome(input.genome)
	if (input.byCoord) {
		return {
			byCoord: validBoolean(input.byCoord),
			genome,
			chr: validString(input.chr),
			ranges: input.ranges as any[], // TODO
			alleleLst: input.alleleLst as any[] // TODO
		}
	} else if (input.byName) {
		return {
			genome,
			byName: validBoolean(input.byName),
			lst: validStringArr(input.lst)
		}
	} else throw `SnpRequest payload must be either byCoord and byName`
}

// init() is used to generate server route handler,
// augen.setRoutes() will use it to generate the second argument to expressjs method init,
// such as `app.get(api.endpoint, init({app, genomes}))`
function init({ genomes }) {
	return async function (req, res) {
		// use the colon syntax for clarity, the 'as' syntax is an assertion that skips type check
		const q: SnpRequest = req.query
		console.log(genomes[q.genome])
		// can also use 'satisfies' keyword instead of colon syntax;
		// do not use 'as' keyword, which is less strict than 'satisfies'
		res.send({} satisfies SnpResponse)
		// or perhaps more commonly,
		// const result: SnpResponse = someFunction(q)
		// res.send(result)
	}
}
