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
			}
			// examples:[
			//     // {
			//     //     request: {
			//     //         body: { input: 'kr', genome: 'hg38-test' }
			//     //     },
			//     //     response: {
			//     //         header: { status: 200 },

			//     //     }
			//     // }
			// ]
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

export type getViolinDataRequest = {
	genome: string
	dslabel: string
	embedder: string
	devicePixelRatio: number
	maxThickness: number
	screenThickness: number
	filter: Filter
	svgw: number
	orientation: 'horizontal' | 'vertical'
	datasymbol: string
	radius: number
	strokeWidth: number
	axisHeight: number
	rightMargin: number
	unit: string
	plotThickness: number
	termid: string
}

export type getViolinDataResponse = {
	min: number
	max: number
	plots: any
	pvalues: number[]
	plotThickness: number
	uncomputableValueObj: any
}
