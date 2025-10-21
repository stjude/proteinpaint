import type { RouteApi } from '#types'
import { alphaGenomePayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import type { alphaGenomeRequest, AlphaGenomeTypesResponse } from '@sjcrh/proteinpaint-types/routes/alphaGenome.js'
import serverconfig from '#src/serverconfig.js'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'AlphaGenomeTypes',
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
			const params: any = { API_KEY: serverconfig.alphaGenome.API_KEY }
			if (query.ontologyTerms) params.ontologyTerms = query.ontologyTerms
			const result = await run_python('AlphaGenomeTypes.py', JSON.stringify(params))
			const { ontologyTerms, outputTypes, intervals } = JSON.parse(result)
			res.send({
				ontologyTerms: ontologyTerms.sort((a, b) => a.label.localeCompare(b.label)),
				outputTypes,
				intervals
			} satisfies AlphaGenomeTypesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send({ error: e })
		}
	}
}
