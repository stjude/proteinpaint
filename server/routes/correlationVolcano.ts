import type { CorrelationVolcanoRequest, CorrelationVolcanoResponse, RouteApi, ValidGetDataResponse } from '#types'
import { CorrelationVolcanoPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { roundValueAuto } from '#shared/roundValue.js'

export const api: RouteApi = {
	endpoint: 'termdb/correlationVolcano',
	methods: {
		get: {
			...CorrelationVolcanoPayload,
			init
		},
		post: {
			...CorrelationVolcanoPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: CorrelationVolcanoRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'

			const result: CorrelationVolcanoResponse = await compute(q, ds, genome)
			res.send(result)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

async function compute(q, ds, genome) {
	const terms = [q.featureTw, ...q.variableTwLst]
	const data = await getData(
		{
			filter: q.filter,
			filter0: q.filter0,
			terms
		},
		ds,
		genome
	)
	if (data.error) throw data.error

	return
}

export function validate_correlationVolcano(ds: any) {
	const cv = ds.cohort.correlationVolcano
	if (!cv) return
	if (typeof cv.feature != 'object') throw 'cv.feature not obj'
	if (cv.feature.termType == 'geneExpression') {
		if (!ds.queries?.geneExpression) throw 'cv.feature.termType=geneExpression not supported by ds'
	} else {
		throw 'unknown cv.feature.termType'
	}
	if (typeof cv.variables != 'object') throw 'cv.variables not obj'
	if (cv.variables.type == 'dictionaryTerm') {
		if (!Array.isArray(cv.variables.termIds)) throw 'cv.variables.termIds not array when type=dictionaryTerm'
		for (const id of cv.variables.termIds) {
			const t = ds.cohort.termdb.q.termjsonByOneid(id)
			if (!t) throw 'cv.variables.termIds: unknown id: ' + id
			if (t.type != 'integer' && t.type != 'float') throw 'cv.variables.termIds: not integer/float: ' + id
		}
	} else {
		throw 'unknown cv.variables.type'
	}
}
