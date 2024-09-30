import { getStat } from '#src/health.ts'
import { HealthCheckResponse } from '#types'

export const api = {
	endpoint: 'healthcheck',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						const health = (await getStat(genomes)) as HealthCheckResponse
						const q = req.query
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
			},
			request: {
				typeId: null
				//valid: default to type checker
			},
			response: {
				typeId: 'HealthCheckResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}
