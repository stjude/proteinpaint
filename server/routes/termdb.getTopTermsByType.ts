import {
	TermdbTopTermsByTypeRequest,
	TermdbTopTermsByTypeResponse
} from '#shared/types/routes/termdb.getTopTermsByType.ts'
import path from 'path'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import { get_samples } from '#src/termdb.sql.js'
import { TermTypes } from '#shared/terms.js'

export const api = {
	endpoint: 'termdb/getTopTermsByType',
	methods: {
		all: {
			init,
			request: {
				typeId: 'TermdbTopTermsByTypeRequest'
			},
			response: {
				typeId: 'TermdbTopTermsByTypeResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as TermdbTopTermsByTypeRequest
			const type = q.type
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries[type]) throw 'not supported on dataset'

			const t = Date.now()
			const terms = await ds.queries[type].getTopTerms(q)
			res.send({ terms } as TermdbTopTermsByTypeResponse)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

export function validate_query_getTopTermsByType(ds: any, genome: any) {
	const types = [TermTypes.METABOLITE_INTENSITY] //maybe later on other types are supported
	for (const type of types) {
		if (ds.queries[type]) {
			const q = ds.queries[type]
			if (!q) return
			if (q.src == 'gdcapi') gdcValidateQuery(ds, genome, type)
			else if (q.src == 'native') nativeValidateQuery(ds, type)
			else throw 'unknown topVariablyExpressedGenes.src'
		}
	}
}

function nativeValidateQuery(ds: any, type: string) {
	ds.queries[type].getTopTerms = async (q: TermdbTopTermsByTypeRequest) => {
		const typeQuery = ds.queries[type] //query to search top terms by type
		// get list of samples that are used in current analysis; gE.samples[] contains all sample integer ids with exp data
		const samples = [] as string[]
		if (q.filter) {
			// get all samples pasing pp filter, may contain those without exp data
			const sidlst = await get_samples(q.filter, ds)
			// [{id:int}]
			// filter for those with exp data from q.samples[]
			for (const i of sidlst) {
				if (typeQuery.samples.includes(i.id)) {
					// this sample passing filter also has exp data; convert to string name
					const n: string = ds.cohort.termdb.q.id2sampleName(i.id)
					if (!n) throw 'sample id cannot convert to string name'
					samples.push(n)
				}
			}
		} else {
			// no filter, use all samples with exp data
			for (const i of typeQuery.samples) {
				const n: string = ds.cohort.termdb.q.id2sampleName(i.id)
				if (!n) throw 'sample id cannot convert to string name'
				samples.push(n)
			}
		}

		// call rust to compute top genes on these samples
		const terms = await computeTopTerms(q, ds, typeQuery.file, samples)
		return terms
	}
}

async function computeTopTerms(q, ds, file, samples) {
	// The param option to calculate variance.
	// It supports variance as well as interquartile region.
	console.log(q)
	const input_json = {
		input_file: file,
		samples: samples.join(','),
		param: 'var'
	}
	const rust_result = await run_rust('computeTopTerms', JSON.stringify(input_json))
	const rust_result_list = rust_result.split('\n')

	let output_json
	for (const item of rust_result_list) {
		if (item.includes('output_json')) {
			output_json = JSON.parse(item.replace('output_json:', ''))
		} else {
			console.log(item)
		}
	}
	const result = output_json.map(i => i.metabolite)
	return result
}

function gdcValidateQuery(ds: any, genome: any, type: string) {
	ds.queries[type].getTopTerms = async (q: TermdbTopTermsByTypeRequest) => {
		return []
	}
}
