import type { RoutePayload, RouteApi } from '#types'
import { run_python } from '@sjcrh/proteinpaint-python'
import type { alphaGenomeTypesResponse } from '@sjcrh/proteinpaint-types/routes/alphaGenomeTypes.js'
import serverconfig from '#src/serverconfig.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'alphaGenomeTypesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'alphaGenomeTypesResponse' }
}
/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'AlphaGenomeTypes',
	methods: {
		get: payload,
		post: payload
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const params: any = { API_KEY: serverconfig.alphaGenome.API_KEY }
			const result = await run_python('AlphaGenomeTypes.py', JSON.stringify(params))
			const { ontologyTerms, outputTypes, intervals } = JSON.parse(result)
			res.send({
				ontologyTerms: ontologyTerms.sort((a, b) => a.label.localeCompare(b.label)),
				outputTypes,
				intervals
			} satisfies alphaGenomeTypesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send({ error: e })
		}
	}
}
