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

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: alphaGenomeRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const params = JSON.stringify({
				chromosome: query.chromosome,
				position: query.position,
				reference: query.reference,
				alternate: query.alternate
			})
			const url = await run_python('alphaGenome.py', params)
			res.send({ plotImage: url } satisfies alphaGenomeResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send(e)
		}
	}
}
