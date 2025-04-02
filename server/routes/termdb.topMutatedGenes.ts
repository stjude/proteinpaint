import type { topMutatedGeneRequest, topMutatedGeneResponse, RouteApi } from '#types'
import { topMutatedGenePayload } from '#types/checkers'
import { get_samples } from '#src/termdb.sql.js'
import { mayLog } from '#src/helpers.ts'

export const api: RouteApi = {
	endpoint: 'termdb/topMutatedGenes',
	methods: {
		get: {
			init,
			...topMutatedGenePayload
		},
		post: {
			init,
			...topMutatedGenePayload
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: topMutatedGeneRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw 'genome missing'
			const ds = g.datasets?.[q.dslabel]
			if (!ds) throw 'ds missing'
			if (!ds.queries?.topMutatedGenes) throw 'not supported by ds'
			const genes = await ds.queries.topMutatedGenes.get(q)
			const payload: topMutatedGeneResponse = { genes }
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.trace(e)
		}
	}
}

export function validate_query_getTopMutatedGenes(ds: any, genome: any) {
	const q = ds.queries?.topMutatedGenes
	if (!q) return // ds not equipped
	if (typeof q.get == 'function') return // ds supplies the getter. done
	// add getter with built in logic
	q.get = async (param: topMutatedGeneRequest) => {
		const n_gene = 15

		let sampleStatement = ''
		if (param.filter) {
			const lst = await get_samples(param.filter, ds)
			if (lst.length == 0) throw 'empty sample filter'
			sampleStatement = `WHERE sample IN (${lst.map(i => i.id).join(',')})`
		}

		const fields = [
			'snv_mfndi',
			'snv_splice',
			'snv_utr',
			'snv_s',
			'sv',
			'fusion',
			'cnv_1mb_01',
			'cnv_1mb_02',
			'cnv_1mb_03',
			'cnv_2mb_01',
			'cnv_2mb_02',
			'cnv_2mb_03',
			'cnv_4mb_01',
			'cnv_4mb_02',
			'cnv_4mb_03'
		]

		const query = `WITH
		filtered AS (
			SELECT genesymbol, ${fields.join('+')} AS total FROM genesamplemutationcount
			${sampleStatement}
		)
		SELECT genesymbol, SUM(total) AS count
		FROM filtered
		GROUP BY genesymbol
		ORDER BY count DESC
		LIMIT ${n_gene}`
		const t = Date.now()
		const genes = ds.cohort.db.connection.prepare(query).all()
		mayLog('Top mutated gene sql', Date.now() - t, 'ms')
		const results = []
		for (const g of genes) {
			results.push({ gene: g.genesymbol })
		}
		return results
	}
}
