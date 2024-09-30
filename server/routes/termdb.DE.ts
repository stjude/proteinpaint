//import fs from 'fs'
import path from 'path'
import type { DERequest, DEResponse } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { get_ds_tdb } from '../src/termdb.js'
import run_R from '../src/run_R.js'
import serverconfig from '../src/serverconfig.js'

export const api = {
	endpoint: 'DEanalysis',
	methods: {
		all: {
			init,
			request: {
				typeId: 'DERequest'
			},
			response: {
				typeId: 'DEResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			const results = await run_DE(req.query as DERequest, ds)
			res.send(results)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function run_DE(param: DERequest, ds: any) {
	/*
	param{}
		samplelst{}
			groups[]
				values[] // using integer sample id
	*/
	if (param.samplelst?.groups?.length != 2) throw '.samplelst.groups.length!=2'
	if (param.samplelst.groups[0].values?.length < 1) throw 'samplelst.groups[0].values.length<1'
	if (param.samplelst.groups[1].values?.length < 1) throw 'samplelst.groups[1].values.length<1'
	// txt file uses string sample name, must convert integer sample id to string
	// txt file uses string sample name, must convert integer sample id to string

	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw 'unknown data type for rnaseqGeneCount'
	const group1names = [] as string[]
	//let group1names_not_found = 0
	//const group1names_not_found_list = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (q.allSampleSet.has(n)) {
			group1names.push(n)
		} else {
			//group1names_not_found += 1
			//group1names_not_found_list.push(n)
		}
	}
	const group2names = [] as string[]
	//let group2names_not_found = 0
	//const group2names_not_found_list = []
	for (const s of param.samplelst.groups[1].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (q.allSampleSet.has(n)) {
			group2names.push(n)
		} else {
			//group2names_not_found += 1
			//group2names_not_found_list.push(n)
		}
	}

	//console.log('Sample size of group1:', group1names.length)
	//console.log('Sample size of group2:', group2names.length)
	const sample_size1 = group1names.length
	const sample_size2 = group2names.length
	//console.log('group1names_not_found_list:', group1names_not_found_list)
	//console.log('group2names_not_found_list:', group2names_not_found_list)
	//console.log('Number of group1 names not found:', group1names_not_found)
	//console.log('Number of group2 names not found:', group2names_not_found)
	if (sample_size1 < 1) throw 'sample size of group1 < 1'
	if (sample_size2 < 1) throw 'sample size of group2 < 1'
	// pass group names and txt file to rust

	const cases_string = group1names.map(i => i).join(',')
	const controls_string = group2names.map(i => i).join(',')
	const expression_input = {
		case: cases_string,
		control: controls_string,
		input_file: q.file,
		min_count: param.min_count,
		min_total_count: param.min_total_count
	}
	//console.log('expression_input:', expression_input)
	//fs.writeFile('test.txt', JSON.stringify(expression_input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const sample_size_limit = 8 // Cutoff to determine if parametric estimation using edgeR should be used or non-parametric estimation using wilcoxon test
	let result
	if ((group1names.length <= sample_size_limit && group2names.length <= sample_size_limit) || param.method == 'edgeR') {
		// edgeR will be used for DE analysis
		const time1 = new Date().valueOf()
		result = JSON.parse(
			await run_R(path.join(serverconfig.binpath, 'utils', 'edge.R'), JSON.stringify(expression_input))
		)
		const time2 = new Date().valueOf()
		console.log('Time taken to run edgeR:', time2 - time1, 'ms')
		param.method = 'edgeR'
		//console.log("result:",result)
	} else if (param.method == 'wilcoxon') {
		// Wilcoxon test will be used for DE analysis
		const time1 = new Date().valueOf()
		const rust_output = await run_rust('DEanalysis', JSON.stringify(expression_input))
		const time2 = new Date().valueOf()
		for (const line of rust_output.split('\n')) {
			if (line.startsWith('adjusted_p_values:')) {
				result = JSON.parse(line.replace('adjusted_p_values:', ''))
			} else {
				//console.log(line)
			}
		}
		console.log('Time taken to run rust DE pipeline:', time2 - time1, 'ms')
		param.method = 'wilcoxon'
	} else {
		// Wilcoxon test will be used for DE analysis
		const time1 = new Date().valueOf()
		const rust_output = await run_rust('DEanalysis', JSON.stringify(expression_input))
		const time2 = new Date().valueOf()
		for (const line of rust_output.split('\n')) {
			if (line.startsWith('adjusted_p_values:')) {
				result = JSON.parse(line.replace('adjusted_p_values:', ''))
			} else {
				//console.log(line)
			}
		}
		console.log('Time taken to run rust DE pipeline:', time2 - time1, 'ms')
		param.method = 'wilcoxon'
	}
	//console.log("result:",result)
	return { data: result, sample_size1: sample_size1, sample_size2: sample_size2, method: param.method } as DEResponse
}
