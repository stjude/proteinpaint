import type { RoutePayload, TermdbAggregateMatrixRequest, TermdbAggregateMatrixResponse, RouteApi } from '#types'
import { validGenomeDs } from '#routes/common.ts'
import { getAggMatrixData } from './getAggMatrixData.ts'

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
    return { 
        ...validGenomeDs(input)
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

            result = await getAggMatrixData(q, ds) 
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
