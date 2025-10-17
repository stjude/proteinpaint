import type { RouteApi } from '#types'
import { alphaGenomePayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import type { alphaGenomeRequest, alphaGenomeResponse } from '@sjcrh/proteinpaint-types/routes/alphaGenome.js'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'alphaGenome',
	methods: {
		get: {
			...alphaGenomePayload,
			init
		},
		post: {
			...alphaGenomePayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const query: alphaGenomeRequest = req.query

			const params = {
				chromosome: query.chromosome,
				position: query.position,
				reference: query.reference,
				alternate: query.alternate
			}
			if (query.ontologyTerms) params['ontologyTerms'] = query.ontologyTerms
			const url = await run_python('alphaGenome.py', JSON.stringify(params))
			res.send({ plotImage: url } satisfies alphaGenomeResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send({ error: e })
		}
	}
}
