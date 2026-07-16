import type { RoutePayload, RouteApi, TermdbPseudobulkRequest, TermdbPseudobulkResponse} from '#types'
import { validGenomeDs } from '#routes/common.ts'

export const payload: RoutePayload = {
    init,
    request: {
        typeId: 'TermdbPseudobulkRequest',
        checker: validPseudobulkRequest
    },
    response: { typeId: 'TermdbPseudobulkResponse' }
}

export const api: RouteApi = {
    endpoint: 'termdb/pseudobulk',
    methods: {
        get: payload,
        post: payload
    }
}

function validPseudobulkRequest(input): TermdbPseudobulkRequest {
    return {
        ...validGenomeDs(input),
        termlst: input.termlst
    }
}

function init({ genomes }) {
    return async (req, res): Promise<void> => {
        const q = req.query
        let result
        try {
            const g = genomes[q.genome]
            if (!g) throw new Error('Invalid genome name')
            const ds = g.datasets[q.dslabel]
            if (!ds) throw new Error('Invalid dataset name')
            if (!ds.queries.singleCell?.pseudobulk || ds.queries.singleCell.pseudobulk.get) {
                throw new Error('Dataset does not support single cell pseudobulk data.')
            }
            result = await ds.queries.singleCell.pseudobulk.get(q)
        } catch (e: any) {
            if (e.stack) console.log(e.stack)
            result = {
                status: e.status || 400,
                error: e.message || e
            }
        }
        res.send(result  satisfies TermdbPseudobulkResponse)
    }
}