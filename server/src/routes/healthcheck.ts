import { getStat } from '#src/health.ts'
import type { HealthCheckRequest, HealthCheckResponse, RouteApi } from '#types'

export const api: RouteApi = {
	endpoint: 'healthcheck',
	methods: {
		// Support GET method only, since the URL is expected to be short.
		// There is no need for a fallback to use POST method + body for large payloads that,
		// when encode and added as query paramters, exceed common URL string length limit .
		get: {
			init,
			request: { typeId: 'HealthCheckRequest' /*, checkers: TODO write validator */ },
			response: { typeId: 'HealthCheckResponse' }
		}
	}
}

function init(arg) {
	const genomes: any = arg.genomes
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
