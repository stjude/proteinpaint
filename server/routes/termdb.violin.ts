import type { getViolinRequest, getViolinResponse } from '#types'
import { trigger_getViolinPlotData } from '#src/termdb.violin.js'

export const api: any = {
	endpoint: 'termdb/violin',
	methods: {
		all: {
			init,
			request: {
				typeId: 'getViolinRequest'
			},
			response: {
				typeId: 'getViolinResponse'
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
							termid: 'agedx'
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as getViolinRequest
		let data
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'
			data = (await trigger_getViolinPlotData(q, null, ds, g)) as getViolinResponse
		} catch (e: any) {
			data = { error: e?.message || e } as getViolinResponse
			if (e instanceof Error && e.stack) console.log(e)
		}
		res.send(data)
	}
}
