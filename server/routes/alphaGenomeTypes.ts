import type { RouteApi } from '#types'
import { alphaGenomePayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import type {
	alphaGenomeRequest,
	AlphaGenomeTypesResponse
} from '@sjcrh/proteinpaint-types/routes/alphaGenome.js'
import { on } from 'events'

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
			const params = query.ontologyTerms? { ontologyTerms: query.ontologyTerms }: {}
			const result = await run_python('AlphaGenomeTypes.py', JSON.stringify(params))
			let {ontologyTerms, outputTypes} = JSON.parse(result)
			const ontologyKeys = Object.keys(ontologyTerms)
			ontologyTerms = ontologyKeys.map(k => ({ label: ontologyTerms[k], value: k }))
			ontologyTerms = ontologyTerms.sort((a, b) => a.label.localeCompare(b.label))
			res.send({ ontologyTerms, outputTypes } satisfies AlphaGenomeTypesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send({ error: e })
		}
	}
}
