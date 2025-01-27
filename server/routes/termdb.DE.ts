//import fs from 'fs'
import path from 'path'
import type { DERequest, DEResponse, ExpressionInput, RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { get_ds_tdb } from '../src/termdb.js'
import run_R from '../src/run_R.js'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '../src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'DEanalysis',
	methods: {
		get: {
			...diffExpPayload,
			init
		},
		post: {
			...diffExpPayload,
			init
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
			let term_results: any = []
			if (q.tw) {
				const terms = [q.tw]
				term_results = await getData(
					{
						filter: q.filter,
						filter0: q.filter0,
						terms
					},
					ds,
					genome
				)
				if (term_results.error) throw term_results.error
			}
			const results = await run_DE(req.query as DERequest, ds, term_results)
			res.send(results)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function run_DE(param: DERequest, ds: any, term_results: any) {
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
	param.storage_type = ds.queries.rnaseqGeneCount.storage_type

	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw 'unknown data type for rnaseqGeneCount'
	const group1names = [] as string[]
	//let group1names_not_found = 0
	//const group1names_not_found_list = []
	const conf1_group1: (string | number)[] = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (q.allSampleSet.has(n)) {
			group1names.push(n)
			if (param.tw) {
				conf1_group1.push(term_results.samples[s.sampleId][param.tw.$id]['value'])
			}
		} else {
			//group1names_not_found += 1
			//group1names_not_found_list.push(n)
		}
	}
	const group2names = [] as string[]
	//let group2names_not_found = 0
	//const group2names_not_found_list = []
	const conf1_group2: (string | number)[] = []
	for (const s of param.samplelst.groups[1].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (q.allSampleSet.has(n)) {
			group2names.push(n)
			if (param.tw) {
				conf1_group2.push(term_results.samples[s.sampleId][param.tw.$id]['value'])
			}
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
	//group 1 by default is selected as the control group. Later on we can allow user to select which group is control and which is treatment. Reason to do this is to first select the group against which the comparison is to be made in the DE analysis. This is important for the interpretation of the results as analyses is context dependent based on the biological question. If the user wants to compare the expression of a specific gene between 2 groups, then the user should select the group that is not of interest as the control group.

	const expression_input = {
		case: controls_string,
		control: cases_string,
		data_type: 'do_DE',
		input_file: q.file,
		min_count: param.min_count,
		min_total_count: param.min_total_count,
		storage_type: param.storage_type
	} as ExpressionInput

	if (param.tw) {
		expression_input.conf1 = [...conf1_group2, ...conf1_group1] // Make sure the order of the groups is same as in expression_input case and control
		expression_input.conf1_type = param.tw.term.type
	}

	//console.log('expression_input:', expression_input)
	//console.log("param.method:",param.method)
	//fs.writeFile('test.txt', JSON.stringify(expression_input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const sample_size_limit = 8 // Cutoff to determine if parametric estimation using edgeR should be used or non-parametric estimation using wilcoxon test
	let result
	if (group1names.length <= sample_size_limit && group2names.length <= sample_size_limit) {
		// variance of genes do not need to be computed when sample size is very low as its already very fast
		const time1 = new Date().valueOf()
		result = JSON.parse(
			await run_R(path.join(serverconfig.binpath, 'utils', 'edge.R'), JSON.stringify(expression_input))
		)
		mayLog('Time taken to run edgeR:', Date.now() - time1, 'ms')
		param.method = 'edgeR'
	} else if (param.method == 'edgeR') {
		// edgeR will be used for DE analysis when param.method == 'edgeR'
		const input_topVE_json = {
			input_file: q.file,
			data_type: 'do_calc_var',
			case: cases_string,
			control: controls_string,
			//filter_extreme_values: q.filter_extreme_values,
			num_genes: 3000, // Will be later defined in UI
			rank_type: 'var', // Will be later defined in UI
			min_count: param.min_count,
			min_total_count: param.min_total_count,
			filter_extreme_values: true // Will be later defined in UI
		}
		const time1 = new Date().valueOf()
		const rust_output = await run_rust('DEanalysis', JSON.stringify(input_topVE_json))
		mayLog('Time taken to calculate top variable genes:', Date.now() - time1, 'ms')
		const rust_output_list = rust_output.split('\n')

		let output_json
		for (const item of rust_output_list) {
			if (item.includes('output_json:')) {
				output_json = JSON.parse(item.replace('output_json:', ''))
			} else {
				console.log(item)
			}
		}
		expression_input.VarGenes = output_json.map(i => i.gene_symbol).join(',')
		console.log('expression_input:', expression_input)

		const time2 = new Date().valueOf()
		result = JSON.parse(
			await run_R(path.join(serverconfig.binpath, 'utils', 'edge.R'), JSON.stringify(expression_input))
		)
		mayLog('Time taken to run edgeR:', Date.now() - time2, 'ms')
		param.method = 'edgeR'
		//console.log("result:",result)
	} else {
		// Wilcoxon test will be used for DE analysis
		const expression_input = {
			case: controls_string,
			control: cases_string,
			data_type: 'do_DE',
			input_file: q.file,
			min_count: param.min_count,
			min_total_count: param.min_total_count,
			storage_type: param.storage_type
		} as ExpressionInput
		const time1 = new Date().valueOf()
		result = JSON.parse(await run_rust('DEanalysis', JSON.stringify(expression_input)))
		mayLog('Time taken to run rust DE pipeline:', Date.now() - time1, 'ms')
		param.method = 'wilcoxon'
	}
	//console.log("result:", result)
	return { data: result, sample_size1: sample_size1, sample_size2: sample_size2, method: param.method } as DEResponse
}
