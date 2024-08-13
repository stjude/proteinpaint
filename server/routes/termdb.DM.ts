import path from 'path'
import { DMRequest, DMResponse } from '../shared/types/routes/termdb.DM.ts'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { get_ds_tdb } from '../src/termdb.js'
import run_R from '../src/run_R.js'
import serverconfig from '../src/serverconfig.js'

export const api = {
	endpoint: 'DManalysis',
	methods: {
		all: {
			init,
			request: {
				typeId: 'DMRequest'
			},
			response: {
				typeId: 'DMResponse'
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
			const results = await run_DM(req.query as DMRequest, ds)
			res.send(results)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function run_DM(param: DMRequest, ds: any) {
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

	const q = ds.queries.metaboliteIntensity
	if (!q) return
	if (!q.file) throw 'unknown data type for metaboliteIntensity'
	const group1names = [] as string[]
	//let group1names_not_found = 0
	//const group1names_not_found_list = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		group1names.push(n)
	}
	const group2names = [] as string[]

	for (const s of param.samplelst.groups[1].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		group2names.push(n)
	}

	const sample_size1 = group1names.length
	const sample_size2 = group2names.length

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

	const sample_size_limit = 8 // Cutoff to determine if parametric estimation using edgeR should be used or non-parametric estimation using wilcoxon test
	let result

	const time1 = new Date().valueOf()
	console.log(JSON.stringify(expression_input))
	const rust_output = await run_rust('DManalysis', JSON.stringify(expression_input))
	console.log('rust_output:')
	console.log(rust_output)
	const time2 = new Date().valueOf()
	for (const line of rust_output.split('\n')) {
		if (line.startsWith('adjusted_p_values:')) {
			result = JSON.parse(line.replace('adjusted_p_values:', ''))
		} else {
			//console.log(line)
		}
	}
	console.log('Time taken to run rust DM pipeline:', time2 - time1, 'ms')
	param.method = 'wilcoxon'
	return { data: result, sample_size1: sample_size1, sample_size2: sample_size2, method: param.method } as DMResponse
}
