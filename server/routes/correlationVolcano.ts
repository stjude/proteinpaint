import type { CorrelationVolcanoRequest, CorrelationVolcanoResponse, RouteApi } from '#types'
import { CorrelationVolcanoPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { mayLog } from '#src/helpers.ts'
import { getStdDev } from './termdb.descrstats.ts'

// to avoid crashing r, an array must meet below; otherwise the variable is skipped
const minArrayLength = 3 // minimum number of values

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
			const result = await compute(q, ds)
			res.send(result)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

async function compute(q: CorrelationVolcanoRequest, ds: any) {
	if (!q.featureTw.$id) throw 'featureTw.$id missing'
	if (!ds.cohort.correlationVolcano.feature.termTypes.includes(q.featureTw?.term.type))
		throw 'unsupported featureTw.term.type'
	const data = await getData(
		{
			filter: q.filter,
			filter0: q.filter0,
			terms: [q.featureTw, ...q.variableTwLst],
			__protected__: q.__protected__
		},
		ds
	)
	if (data.error) throw data.error

	const vtid2array = new Map() // k: variable tw $id, v: two arrays to calculate correlation for
	for (const tw of q.variableTwLst) {
		vtid2array.set(tw.$id, { id: tw.$id, v1: [], v2: [] })
	}
	// populate with each variable tw
	for (const sid in data.samples) {
		const featureValue = data.samples[sid][q.featureTw.$id]?.value
		if (!Number.isFinite(featureValue)) continue // missing value. ignore this sample
		for (const tw of q.variableTwLst) {
			if (!tw.$id) throw 'variableTwLst[].$id missing' // required to avoid tsc err
			const variableValue = data.samples[sid][tw.$id]?.value
			if (!Number.isFinite(variableValue)) continue // missing. ignore this from input into tw array
			vtid2array.get(tw.$id).v1.push(featureValue)
			vtid2array.get(tw.$id).v2.push(variableValue)
		}
	}

	/** To calculate correlation, ensure variables: 
	 * 1) not less that minimum number of values in each array 
	 * 2) both vectors have a standard deviation >0
	If not, show term in legend on client
	*/
	const acceptedVariables: { v1: number; v2: number; id: string }[] = [],
		skippedVariables: { tw$id: string }[] = []
	for (const [tid, v] of vtid2array) {
		if (v.v1.length < minArrayLength || v.v2.length < minArrayLength || getStdDev(v.v1) == 0 || getStdDev(v.v2) == 0) {
			skippedVariables.push({ tw$id: tid })
			continue
		}
		acceptedVariables.push(v)
	}

	const result: CorrelationVolcanoResponse = { skippedVariables, variableItems: [] }

	if (!acceptedVariables.length) return result

	const input = {
		method: q.correlationMethod || 'pearson',
		terms: acceptedVariables
	}

	/*
	fs.writeFile('test.txt', JSON.stringify(input), function (err) {
		// For catching input to rust pipeline, in case of an error
		if (err) return console.log(err)
	})
	*/

	const time1 = Date.now()
	const output = {
		terms: JSON.parse(await run_R('corr.R', JSON.stringify(input)))
	}
	mayLog('Time taken to run correlation analysis:', Date.now() - time1)

	for (const t of output.terms) {
		const t2 = {
			tw$id: t.id,
			sampleSize: t.sample_size,
			//sampleSize: input.terms.get(t.id).v1.length, // This was not working so passed the length of each array from R
			correlation: t.correlation,
			original_pvalue: t.original_p_value,
			adjusted_pvalue: t.adjusted_p_value
		}
		result.variableItems.push(t2)
	}
	return result
}

export function validate_correlationVolcano(ds: any) {
	const cv = ds.cohort.correlationVolcano
	if (!cv) return
	if (typeof cv.feature != 'object') throw 'cv.feature not obj'
	if (!Array.isArray(cv.feature.termTypes)) throw 'cv.feature.termTypes[] not array'
	for (const t of cv.feature.termTypes) {
		if (t == 'geneExpression') {
			if (!ds.queries?.geneExpression) throw 'geneExpression cv.feature is not supported'
		} else if (t == 'ssGSEA') {
			if (!ds.queries?.ssGSEA) throw 'ssGSEA cv.feature is not supported'
		} else {
			throw 'unknown cv.feature.termType'
		}
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
