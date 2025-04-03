import type { topMutatedGeneRequest, topMutatedGeneResponse, MutatedGene, RouteApi } from '#types'
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
	// furbish with built in logic
	if (!q.arguments) {
		q.arguments = []
		// auto fill arguments for topMG query based on datatype availability
		q.arguments.push({ id: 'maxGenes', label: 'Gene Count', type: 'number', value: 50 })
		if (ds.queries.snvindel) {
			q.arguments.push({ id: 'snv_mfndi', label: 'Protein-changing mutation', type: 'string', value: '1' })
			q.arguments.push({ id: 'snv_splice', label: 'Splice mutation', type: 'string', value: '1' })
			q.arguments.push({ id: 'snv_utr', label: 'UTR mutation', type: 'string', value: '1' })
			q.arguments.push({ id: 'snv_s', label: 'Silent mutation', type: 'string', value: '1' })
		}
		if (ds.queries.svfusion) {
			q.arguments.push({ id: 'sv', label: 'Structural variation', type: 'string', value: '1' })
			q.arguments.push({ id: 'fusion', label: 'RNA fusion', type: 'string', value: '1' })
		}
		/*
		cnv should only allow to check one option.
		[ ] cnv
		    Max size radio select
			Min absolute log(ratio) radio select
		if(ds.queries.cnv) {
			q.arguments.push({ id: 'cnv_1mb_01', label: 'CNV <1Mb abs(logratio)<0.1', type: 'string', value: '1' })
			q.arguments.push({ id: 'cnv_1mb_02', label: 'CNV <1Mb abs(logratio)<0.2', type: 'string', value: '1' })
			q.arguments.push({ id: 'cnv_1mb_03', label: 'CNV <1Mb abs(logratio)<0.3', type: 'string', value: '1' })
		}
		*/
	}
	q.get = async (param: topMutatedGeneRequest) => {
		let sampleStatement = ''
		if (param.filter) {
			const lst = await get_samples(param.filter, ds)
			if (lst.length == 0) throw 'empty sample filter'
			sampleStatement = `WHERE sample IN (${lst.map(i => i.id).join(',')})`
		}

		const fields: string[] = []
		if (param.snv_mfndi == '1') fields.push('snv_mfndi')
		if (param.snv_splice == '1') fields.push('snv_splice')
		if (param.snv_utr == '1') fields.push('snv_utr')
		if (param.snv_s == '1') fields.push('snv_s')
		if (param.sv == '1') fields.push('sv')
		if (param.fusion == '1') fields.push('fusion')
		/*
			'cnv_1mb_01',
			'cnv_1mb_02',
			'cnv_1mb_03',
			'cnv_2mb_01',
			'cnv_2mb_02',
			'cnv_2mb_03',
			'cnv_4mb_01',
			'cnv_4mb_02',
			'cnv_4mb_03'
			*/

		// TODO preserve count per data type to return as mutation stat
		const query = `WITH
		filtered AS (
			SELECT genesymbol, ${fields.join('+')} AS total FROM genesamplemutationcount
			${sampleStatement}
		)
		SELECT genesymbol, SUM(total) AS count
		FROM filtered
		GROUP BY genesymbol
		ORDER BY count DESC
		LIMIT ${param.maxGenes || 20}`
		const t = Date.now()
		const genes = ds.cohort.db.connection.prepare(query).all()
		mayLog('Top mutated gene sql', Date.now() - t, 'ms')
		const results: MutatedGene[] = []
		for (const g of genes) {
			results.push({ gene: g.genesymbol })
		}
		return results
	}
}
