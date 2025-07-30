import type { TermdbTopTermsByTypeRequest, TermdbTopTermsByTypeResponse, RouteApi } from '#types'
import { termdbTopTermsByTypePayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { get_samples } from '#src/termdb.sql.js'
import { TermTypes } from '#shared/terms.js'

export const api: RouteApi = {
	endpoint: 'termdb/getTopTermsByType',
	methods: {
		get: {
			...termdbTopTermsByTypePayload,
			init
		},
		post: {
			...termdbTopTermsByTypePayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbTopTermsByTypeRequest = req.query
			const type = q.type
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries[type]) throw 'not supported on dataset'

			//const t = Date.now()
			const terms = await ds.queries[type].getTopTerms(q)
			res.send({ terms } satisfies TermdbTopTermsByTypeResponse)
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
			const sidlst = await get_samples(q, ds)
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
		const terms = await computeTopTerms(typeQuery.file, samples, type)
		return terms
	}
}

async function computeTopTerms(file, samples, type) {
	//should support multiple term types
	// The param option to calculate variance.
	// It supports variance as well as interquartile region.
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
		}
	}
	const varMetabolite = output_json.map(i => ({ name: i.metabolite, type }))
	return varMetabolite
}

function gdcValidateQuery(ds: any, genome: any, type: string) {
	ds.queries[type].getTopTerms = async () => {
		return []
	}
}
