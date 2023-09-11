import { getStat } from '#src/health.ts'

export const api = {
	endpoint: 'healthcheck',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						const health = await getStat(genomes)
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
