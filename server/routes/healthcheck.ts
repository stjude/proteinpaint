import { getStat } from '#src/health'
import { HealthCheckResponse } from '#shared/types/routes/healthcheck.ts'

export const api = {
	endpoint: 'healthcheck',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: undefined, res: any): Promise<void> => {
					try {
						const health = (await getStat(genomes)) as HealthCheckResponse
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
