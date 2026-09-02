import { type RoutePayload, type TermdbAggregateMatrixRequest, type TermdbAggregateMatrixResponse, type RouteApi, type Filter } from '#types'
import { validGenomeDs } from '#routes/common.ts'
import { getAggMatrixData, type AggregateMatrixDataRequest } from './getAggMatrixData.ts'

export const payload: RoutePayload = {
    init,
    request: {
        typeId: 'TermdbAggregateMatrixRequest',
        checker: validTermdbAggregateMatrixRequest
    },
    response: { typeId: 'TermdbAggregateMatrixResponse' }
}


export const api: RouteApi = {
    endpoint: 'termdb/aggregateMatrix',
    methods: {
        get: payload,
        post: payload
    }
}

function validTermdbAggregateMatrixRequest(input) {
	if (input.getAvailableMethods === true) {
		return {
			...validGenomeDs(input),
			getAvailableMethods: true,
			columns: input.columns || {}
		}
	}
    if (input.gradientMethod === input.sizeMethod) throw `.gradientMethod and .sizeMethod must be different`
    if (typeof input.gradientMethod != 'string' || !input.gradientMethod) throw `invalid .gradientMethod`
    if (typeof input.sizeMethod != 'string' || !input.sizeMethod) throw `invalid .sizeMethod`

    return { 
        ...validGenomeDs(input),
        gradientMethod: input.gradientMethod,
        sizeMethod: input.sizeMethod,
        rows: input.rows,
        columns: input.columns,
        filter: input.filter ? (input.filter as Filter) : undefined, // TODO: use a filter validator
        filter0: input.filter0 as any,
    }
}


function init({ genomes }) {
    return async (req, res): Promise<void> => {
        const q: TermdbAggregateMatrixRequest = req.query
       
        let result
        try {
            const g = genomes[q.genome]
            if (!g) throw new Error('invalid genome name')
            const ds = g.datasets[q.dslabel]
            if (!ds) throw new Error('invalid dataset name')
			// Methods are capabilities of the column terms that provide the aggregate values.
			const terms = Object.values(q.columns).flat().map((tw: any) => tw.term)
			const availableMethods = ds.getAvailableAggregateMethods?.(terms) || []
			if (q.getAvailableMethods) {
				res.send({ availableMethods } satisfies TermdbAggregateMatrixResponse)
				return
			}
			const methodIds = new Set(availableMethods.map((method: { id: string }) => method.id))
			if (!methodIds.has(q.gradientMethod)) throw new Error(`invalid .gradientMethod: ${q.gradientMethod}`)
			if (!methodIds.has(q.sizeMethod)) throw new Error(`invalid .sizeMethod: ${q.sizeMethod}`)

            result = await getAggMatrixData(q as AggregateMatrixDataRequest, ds)
            if (!result) throw new Error('no result returned from getAggMatrixData')
            if (!result.data || !result.axesLayout) throw new Error('invalid result returned from getAggMatrixData')
        } catch (e: any) {
            if (e.stack) console.log(e.stack)
            result = {
                status: e.status || 400,
                error: e.message || e
            }
        }
        res.send(result satisfies TermdbAggregateMatrixResponse)
    }
}
