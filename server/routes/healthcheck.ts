import { getStat } from '#src/health.ts'
import type { HealthCheckRequest, HealthCheckResponse, RouteApi } from '#types'
import { healthcheckPayload /*, validHealthCheckRequest*/ } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'healthcheck',
	methods: {
		get: {
			...healthcheckPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: HealthCheckRequest = req.query
			//const result = validHealthCheckRequest(q)
			//if (!result.success) throw result.errors
			const health: HealthCheckResponse = await getStat(genomes)
			if (q.dslabel) {
				for (const gn in genomes) {
					const ds = genomes[gn]?.datasets?.[q.dslabel]
					if (!ds?.getHealth) continue
					if (!health.byDataset) health.byDataset = {}
					if (!health.byDataset[q.dslabel]) health.byDataset[q.dslabel] = {}
					health.byDataset[q.dslabel][gn] = ds.getHealth(ds)
				}
			}
			res.send(health)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}
