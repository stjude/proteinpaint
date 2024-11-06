import type { TermsByIdsRequest, TermsByIdsResponse, RouteApi } from '#types'
import { termsByIdsPayload } from '#types'
import { copy_term } from '#src/termdb.js'

export const api: RouteApi = {
	endpoint: 'termdb/termsbyids',
	methods: {
		get: {
			...termsByIdsPayload,
			init
		},
		post: {
			...termsByIdsPayload,
			init
		}
	}
}

/**
 * Initializes the function with the given genomes object and handles the request and response asynchronously.
 *
 * @param {Object} genomes - The object containing genome data.
 * @returns {Promise<void>} A promise representing the asynchronous operation.
 */
function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermsByIdsRequest = req.query
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'
			const results: TermsByIdsResponse = await trigger_gettermsbyid(q, tdb)
			res.send(results)
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/**
 * Retrieves terms by their IDs and sends the terms as a response.
 *
 * @param {Object} q - An object containing the IDs of the terms to retrieve.
 * @param {Object} res - An object with a 'send' function to send the response.
 * @param {Object} tdb - An object with a 'termjsonByOneid' function to retrieve term by ID.
 */
async function trigger_gettermsbyid(q: { ids: any }, tdb: { q: { termjsonByOneid: (arg0: any) => any } }) {
	const terms = {}
	for (const id of q.ids) {
		const term = tdb.q.termjsonByOneid(id)
		if (term) {
			if (term.type == 'categorical' && !term.values) {
				term.values = {}
				term.samplecount = {}
			}
		}
		terms[id] = term ? copy_term(term) : undefined
	}
	return { terms }
}
