import { gettermsbyidsRequest, gettermsbyidsResponse } from '#shared/types/routes/termdb.termsbyids.js'
import { copy_term } from '#src/termdb.js'

export const api: any = {
	endpoint: 'termdb/termsbyids',
	methods: {
		get: {
			init,
			request: {
				typeId: 'gettermsbyidsRequest'
			},
			response: {
				typeId: 'gettermsbyidsResponse'
			}
		},
		post: {
			alternativeFor: 'get',
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
		const q: gettermsbyidsRequest = req.query
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const tdb = ds.cohort.termdb
			if (!tdb) throw 'invalid termdb object'

			await trigger_gettermsbyid(q, res, tdb)
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
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
async function trigger_gettermsbyid(
	q: { ids: any },
	res: { send: (arg0: { terms: any }) => void },
	tdb: { q: { termjsonByOneid: (arg0: any) => any } }
) {
	const terms: gettermsbyidsResponse = {
		terms: {}
	}

	for (const id of q.ids) {
		const term = tdb.q.termjsonByOneid(id)
		if (term) {
			if (term.type == 'categorical' && !term.values && !term.groupsetting?.inuse) {
				term.values = {}
				term.samplecount = {}
			}
		}
		terms[id] = term ? copy_term(term) : undefined
	}
	res.send({
		terms
	})
}
