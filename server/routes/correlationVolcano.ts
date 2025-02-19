import type { CorrelationVolcanoRequest, CorrelationVolcanoResponse, RouteApi } from '#types'
import { CorrelationVolcanoPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import run_R from '../src/run_R.js'
import serverconfig from '../src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import path from 'path'

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
			const result = await compute(q, ds, genome)
			res.send(result)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

async function compute(q: CorrelationVolcanoRequest, ds: any, genome: any) {
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

	const vtid2array = new Map() // k: variable tw $id, v: two arrays to calculate correlation for
	for (const tw of q.variableTwLst) {
		vtid2array.set(tw.$id, { id: tw.$id, v1: [], v2: [] })
	}
	// populate with each variable tw
	for (const sid in data.samples) {
		const featureValue = q.featureTw.$id === undefined ? undefined : data.samples[sid][q.featureTw.$id]?.value
		if (!Number.isFinite(featureValue)) continue // missing value. ignore this sample
		for (const tw of q.variableTwLst) {
			const variableValue = tw.$id === undefined ? undefined : data.samples[sid][tw.$id]?.value
			if (!Number.isFinite(variableValue)) continue // missing. ignore this from input into tw array
			vtid2array.get(tw.$id).v1.push(featureValue)
			vtid2array.get(tw.$id).v2.push(variableValue)
		}
	}

	/** To calculate correlation, ensure variables: 
	 * 1) have at least 4 vectors in each array 
	 * 2) both vectors have a standard deviation greater than 0.05
	If not, show term in legend on client*/
	const [acceptedVariables, skippedVariables] = Array.from(vtid2array.values()).reduce(
		([accepted, skipped], t) => {
			//Need enough values to calculate correlation
			const grterThanOne = t.v1.length > 3 && t.v2.length > 3
			//Need enough to variance in data to calculate correlation
			const significantSD = standardDeviation(t.v1) > 0.05 && standardDeviation(t.v2) > 0.05
			const v = grterThanOne && significantSD ? accepted : skipped
			if (v === accepted) accepted.push(t)
			if (v === skipped) skipped.push({ tw$id: t.id })
			return [accepted, skipped]
		},
		[[], []] as [{ v1: string; v2: string; id: string }[], { tw$id: string }[]]
	)

	const result: CorrelationVolcanoResponse = { skippedVariables, variableItems: [] }

	if (!acceptedVariables.length) return result

	const input = {
		method: q.correlationMethod || 'pearson',
		terms: acceptedVariables
	}

	//console.log("input:",input)
	//fs.writeFile('test.txt', JSON.stringify(input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const time1 = Date.now()
	const output = {
		terms: JSON.parse(await run_R(path.join(serverconfig.binpath, 'utils', 'corr.R'), JSON.stringify(input)))
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

//TODO consider moving to shared, stats.ts or similar
function standardDeviation(arr: number[]) {
	const mean = arr.reduce((s, i) => s + i, 0) / arr.length
	let s = 0
	for (const v of arr) {
		s += Math.pow(v - mean, 2)
	}
	return Math.sqrt(s / (arr.length - 1))
}
