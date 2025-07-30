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

export function validate_query_getTopMutatedGenes(ds: any) {
	const q = ds.queries?.topMutatedGenes
	if (!q) return // ds not equipped
	if (typeof q.get == 'function') return // ds supplies the getter. done
	// furbish with built in logic
	if (!q.arguments) {
		q.arguments = []
		// auto fill arguments for topMG query based on datatype availability
		q.arguments.push({ id: 'maxGenes', label: 'Gene Count', type: 'number', value: 50 })
		if (ds.queries.snvindel) {
			q.arguments.push({ id: 'snv_mfndi', label: 'Protein-changing mutation', type: 'boolean', value: true })
			q.arguments.push({ id: 'snv_splice', label: 'Splice mutation', type: 'boolean', value: true })
			q.arguments.push({ id: 'snv_utr', label: 'UTR mutation', type: 'boolean', value: true })
			q.arguments.push({ id: 'snv_s', label: 'Silent mutation', type: 'boolean', value: true })
		}
		if (ds.queries.svfusion) {
			q.arguments.push({ id: 'sv', label: 'Structural variation', type: 'boolean', value: true })
			q.arguments.push({ id: 'fusion', label: 'RNA fusion', type: 'boolean', value: true })
		}
		/*
		cnv should only allow to check one option.
		[ ] cnv
		    Max size radio select
			Min absolute log(ratio) radio select
		*/
		if (ds.queries.cnv) {
			q.arguments.push({
				id: 'cnv',
				type: 'boolean',
				label: 'CNV',
				checked: false,
				noStyle: true, //This is a hack
				options: [
					{
						id: 'cnv_ms',
						label: 'Max size',
						type: 'radio',
						options: [
							{ id: 'cnv_1mb', label: '<1Mb', value: 'cnv_1mb' },
							{ id: 'cnv_2mb', label: '<2Mb', value: 'cnv_2mb' },
							{ id: 'cnv_4mb', label: '<4Mb', value: 'cnv_4mb' }
						]
					},
					{
						id: 'cnv_logratio',
						label: 'Min absolute log(ratio)',
						type: 'radio',
						options: [
							{ id: '_01', label: '>0.1', value: '_01' },
							{ id: '_02', label: '>0.2', value: '_02' },
							{ id: '_03', label: '>0.3', value: '_03' }
						]
					}
				]
			})
		}
	}
	q.get = async (param: topMutatedGeneRequest) => {
		let sampleStatement = ''
		if (param.filter) {
			const lst = await get_samples(param, ds)
			if (lst.length == 0) throw 'empty sample filter'
			sampleStatement = `WHERE sample IN (${lst.map(i => i.id).join(',')})`
		}

		const fields: string[] = []
		if (param.snv_mfndi) fields.push('snv_mfndi')
		if (param.snv_splice) fields.push('snv_splice')
		if (param.snv_utr) fields.push('snv_utr')
		if (param.snv_s) fields.push('snv_s')
		if (param.sv) fields.push('sv')
		if (param.fusion) fields.push('fusion')
		if (param.cnv == 1 && param.cnv_ms?.type && param.cnv_logratio?.type) {
			//"cnv_ms":{"type":"cnv_1mb","geneList":null}
			// "cnv_logratio":{"type":"_01","geneList":null}
			fields.push(param.cnv_ms.type + param.cnv_logratio.type)
		}
		if (!fields.length) throw 'no fields'

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
