import { getResult } from '#src/gene.js'

export const api: any = {
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
						body: { input: 'kr', genome: 'hg38-test' }
					},
					response: {
						header: { status: 200 },
						body: { hits: ['KRAS'] }
					}
				}
			]
		}
	}
}

api.methods.post = api.methods.get

export type GeneLookupRequest = {
	input: string
	genome: string
	deep: boolean
}

export type GeneLookupResponse = {
	error?: string
	hits: string[]
}
