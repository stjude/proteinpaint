import type { RoutePayload, RouteApi, alphaGenomeRequest, alphaGenomeResponse } from '#types'
import { run_python } from '@sjcrh/proteinpaint-python'
import serverconfig from '#src/serverconfig.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'alphaGenomeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'alphaGenomeResponse' }
}

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'alphaGenome',
	methods: {
		get: payload,
		post: payload
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const query: alphaGenomeRequest = req.query
			const params = {
				API_KEY: serverconfig.alphaGenome.API_KEY,
				chromosome: query.chromosome,
				position: query.position,
				reference: query.reference,
				alternate: query.alternate,
				interval: query.interval
			}
			if (query.ontologyTerms) params['ontologyTerms'] = query.ontologyTerms
			if (query.outputType) params['outputType'] = Number(query.outputType)
			const url = await run_python('alphaGenome.py', JSON.stringify(params))
			res.send({ plotImage: url } satisfies alphaGenomeResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send({ error: e })
		}
	}
}
