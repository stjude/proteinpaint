import { trigger_getGeneExpViolinPlotData } from '#src/termdb.violin.js'
import { getGeneExpViolinRequest, getGeneExpViolinResponse } from '#shared/types/routes/termdb.geneExpViolin.ts'

export const api: any = {
	endpoint: 'termdb/geneExpViolin',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getGeneExpViolinRequest'
			},
			response: {
				typeId: 'getGeneEspViolinResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							gene: 'TP53'
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as getGeneExpViolinRequest
		try {
			const g = genomes[req.query.genome]
			const ds = g.datasets[req.query.dslabel]
			if (!g) throw 'invalid genome name'
			const data = await trigger_getGeneExpViolinPlotData(req.query, null, ds, g) // as getViolinResponse
			res.send(data as getGeneExpViolinResponse)
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
