import type { RouteApi } from '#types'
import { alphaGenomePayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import type {
	alphaGenomeRequest,
	alphaGenomeSampleTypesResponse
} from '@sjcrh/proteinpaint-types/routes/alphaGenome.js'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'alphaGenomeSampleTypes',
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
			const params = { ontologyTerms: query.ontologyTerms }
			console.log(JSON.stringify(params))
			let sampleTypes = await run_python('alphaGenomeSampleTypes.py', JSON.stringify(params))
			sampleTypes = JSON.parse(sampleTypes)
			const keys = Object.keys(sampleTypes)
			sampleTypes = keys.map(k => ({ label: sampleTypes[k], value: k }))
			sampleTypes = sampleTypes.sort((a, b) => a.label.localeCompare(b.label))

			res.send({ sampleTypes } satisfies alphaGenomeSampleTypesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send({ error: e })
		}
	}
}
