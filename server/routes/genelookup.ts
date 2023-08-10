import { getResult } from '#src/gene'

export type GeneLookupRequest = {
	input: string
	genome: string
}

export type GeneLookupResponse = {
	error?: string
	hits: string[]
}

export const api = {
	endpoint: 'genelookup',
	methods: {
		get: {
			init({ genomes }) {
				return (req: any, res: any): void => {
					try {
						const g = genomes[req.query.genome]
						if (!g) throw 'invalid genome name'
						res.send(getResult(g, req.query))
					} catch (e: any) {
						res.send({ error: e.message || e })
						if (e.stack) console.log(e.stack)
					}
				}
			},
			request: {
				typeId: 'GeneLookupRequest'
				//valid: default to type checker
			},
			response: {
				typeId: 'GeneLookupResponse'
				// will combine this with type checker
				//valid: (t) => {}
			},
			examples: [
				{
					request: {
						//header/body/params // fetch opts
					},
					response: {
						status: 200
					}
				},
				{
					request: {
						//header/body/params // fetch opts
					},
					response: {
						status: 400 // malformed request
					}
				}
			]
		}
	}
}
