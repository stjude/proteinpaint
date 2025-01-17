import type { CorrelationVolcanoRequest, CorrelationVolcanoResponse, RouteApi, ValidGetDataResponse } from '#types'
import { CorrelationVolcanoPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import run_R from '../src/run_R.js'
import serverconfig from '../src/serverconfig.js'
//import fs from 'fs'
import path from 'path'
// import { roundValueAuto } from '#shared/roundValue.js'

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
	const data: ValidGetDataResponse = await getData(
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
		const featureValue = data.samples[sid][q.featureTw.$id]?.value
		if (!Number.isFinite(featureValue)) continue // missing value. ignore this sample
		for (const tw of q.variableTwLst) {
			const variableValue = data.samples[sid][tw.$id]?.value
			if (!Number.isFinite(variableValue)) continue // missing. ignore this from input into tw array
			vtid2array.get(tw.$id).v1.push(featureValue)
			vtid2array.get(tw.$id).v2.push(variableValue)
		}
	}

	const input = {
		method: q.method || 'pearson',
		terms: [...vtid2array.values()]
	}

	//console.log("input:",input)
	//fs.writeFile('test.txt', JSON.stringify(input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const time1 = new Date().valueOf()
	const r_output = await run_R(path.join(serverconfig.binpath, 'utils', 'corr.R'), JSON.stringify(input))
	const time2 = new Date().valueOf()
	console.log('Time taken to run correlation analysis:', time2 - time1, 'ms')
	let json_result
	for (const line of r_output.split('\n')) {
		if (line.startsWith('adjusted_p_values:')) {
			json_result = JSON.parse(line.replace('adjusted_p_values:', ''))
		} else {
			// Useful for debugging
			//console.log("line:", line)
		}
	}

	const output = { terms: json_result }

	const result = { variableItems: [] }
	for (const t of output.terms) {
		const t2 = {
			tw$id: t.id,
			sampleSize: t.sample_size,
			//sampleSize: input.terms.get(t.id).v1.length, // This was not working so passed the length of each array from R
			correlation: t.correlation,
			original_pvalue: t.original_p_value, // This is in -log10 scale for volcano plot
			adjusted_pvalue: t.adjusted_p_value // This is in -log10 scale for volcano plot
		}
		result.variableItems.push(t2)
	}
	console.log('result:', result)
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
