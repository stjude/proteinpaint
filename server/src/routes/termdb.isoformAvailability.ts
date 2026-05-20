import type { TermdbIsoformAvailabilityRequest, TermdbIsoformAvailabilityResponse, RouteApi } from '#types'
import { TermdbIsoformAvailabilityPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'termdb/isoformAvailability',
	methods: {
		get: {
			...TermdbIsoformAvailabilityPayload,
			init
		},
		post: {
			...TermdbIsoformAvailabilityPayload,
			init
		}
	}
}

function init({ genomes }) {
	return (req, res): void => {
		try {
			const q: TermdbIsoformAvailabilityRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const isoQ = ds.queries?.isoformExpression
			if (!isoQ) throw 'isoformExpression not configured for this dataset'

			// availableItems is a string[] stored on the query object at validation time
			const itemSet = new Set(isoQ.availableItems || [])
			const available = (q.isoforms || []).filter((id: string) => itemSet.has(id))

			res.send({ available } satisfies TermdbIsoformAvailabilityResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
		}
	}
}
