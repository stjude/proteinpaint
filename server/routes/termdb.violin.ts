import { trigger_getViolinPlotData } from '#src/termdb.violin.js'
import { Filter } from '#shared/types/filter.ts'

export const api: any = {
	endpoint: 'termdb/violin',
	methods: {
		get: {
			init,
			request: {
				typeId: 'getViolinDataRequest'
			},
			response: {
				typeId: 'getViolinDataResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							devicePixelRatio: 2.200000047683716,
							maxThickness: 150,
							screenThickness: 1218,
							filter: {
								type: 'tvslst',
								in: true,
								join: '',
								lst: [
									{
										tag: 'cohortFilter',
										type: 'tvs',
										tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'ABC', label: 'ABC' }] }
									}
								]
							},
							svgw: 227.27272234672367,
							orientation: 'horizontal',
							datasymbol: 'bean',
							radius: 5,
							strokeWidth: 0.2,
							axisHeight: 60,
							rightMargin: 50,
							unit: 'abs',
							plotThickness: 150,
							termid: 'agedx'
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
		try {
			const g = genomes[req.query.genome]
			const ds = g.datasets[req.query.dslabel]
			if (!g) throw 'invalid genome name'
			const data = await trigger_getViolinPlotData(req.query, res, ds, g)
			res.send(data)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e)
		}
	}
}
