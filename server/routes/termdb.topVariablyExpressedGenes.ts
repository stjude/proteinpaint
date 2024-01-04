import {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '#shared/types/routes/termdb.topVariablyExpressedGenes.ts'
import { gdcGetCasesWithExressionDataFromCohort, apihost, geneExpHost } from '../src/mds3.gdc.js'
import path from 'path'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import got from 'got'
import serverconfig from '#src/serverconfig.js'
import { get_samples } from '#src/termdb.sql.js'

export const api = {
	endpoint: 'termdb/topVariablyExpressedGenes',
	methods: {
		get: {
			init,
			request: {
				typeId: 'TermdbTopVariablyExpressedGenesRequest'
			},
			response: {
				typeId: 'TermdbTopVariablyExpressedGenesResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query as TermdbTopVariablyExpressedGenesRequest
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries?.topVariablyExpressedGenes) throw 'not supported on dataset'

			const t = Date.now()
			const genes = await ds.queries.topVariablyExpressedGenes.getGenes(q)
			if (serverconfig.debugmode) console.log('topVariablyExpressedGenes', Date.now() - t, 'ms')

			res.send({ genes } as TermdbTopVariablyExpressedGenesResponse)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

export function validate_query_TopVariablyExpressedGenes(ds: any, genome: any) {
	const q = ds.queries.topVariablyExpressedGenes
	if (!q) return
	if (q.src == 'gdcapi') {
		gdcValidateQuery(ds, genome)
	} else if (q.src == 'native') {
		nativeValidateQuery(ds, genome)
	} else {
		throw 'unknown topVariablyExpressedGenes.src'
	}
	// added getter: q.getGenes()
}

function nativeValidateQuery(ds: any, genome: any) {
	const gE = ds.queries.geneExpression // a separate query required to supply data for computing top genes
	if (!gE) throw 'topVariablyExpressedGenes query given but geneExpression missing'
	if (gE.src != 'native') throw 'topVariablyExpressedGenes is native but geneExpression.src is not native'

	ds.queries.topVariablyExpressedGenes.getGenes = async (q: TermdbTopVariablyExpressedGenesRequest) => {
		// get list of samples that are used in current analysis; gE.samples[] contains all sample integer ids with exp data
		const samples = [] as string[]
		if (q.filter) {
			// get all samples pasing pp filter, may contain those without exp data
			const sidlst = await get_samples(q.filter, ds)
			// [{id:int}]
			// filter for those with exp data from q.samples[]
			for (const i of sidlst) {
				if (gE.samples.includes(i.id)) {
					// this sample passing filter also has exp data; convert to string name
					const n: string = ds.cohort.termdb.q.id2sampleName(i.id)
					if (!n) throw 'sample id cannot convert to string name'
					samples.push(n)
				}
			}
		} else {
			// no filter, use all samples with exp data
			for (const i of gE.samples) {
				const n: string = ds.cohort.termdb.q.id2sampleName(i.id)
				if (!n) throw 'sample id cannot convert to string name'
				samples.push(n)
			}
		}

		// call rust to compute top genes on these samples
		const genes = await computeGenes4nativeDs(q, ds, gE.file, samples)
		return genes
	}
}

async function computeGenes4nativeDs(
	q: TermdbTopVariablyExpressedGenesRequest,
	ds: any,
	matrixFile: string,
	samples: string[]
) {
	// The param option in input JSON is very important. It instructs what method will be used to calculate variation in the counts for a particular gene. It supports variance as well as interquartile region. This is based on the recommendation of this article https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full . This article recommends using interquartile region over variance.
	const input_json = {
		input_file: matrixFile,
		samples: samples.join(','),
		filter_extreme_values: true,
		num_genes: Number(q.maxGenes),
		param: 'var'
	}
	const rust_output = await run_rust('topGeneByExpressionVariance', JSON.stringify(input_json))
	const rust_output_list = rust_output.split('\n')

	let output_json
	for (let item of rust_output_list) {
		if (item.includes('output_json:')) {
			output_json = JSON.parse(item.replace('output_json:', ''))
		} else {
			console.log(item)
		}
	}
	const varGenes = output_json.map(i => i.gene_symbol)
	return varGenes
}

function gdcValidateQuery(ds: any, genome: any) {
	ds.queries.topVariablyExpressedGenes.getGenes = async (q: TermdbTopVariablyExpressedGenesRequest) => {
		if (serverconfig.features.gdcGenes) {
			// for testing on dev, must not set on prod!! delete to trigger api query
			console.log('!!GDC!! using serverconfig.features.gdcGenes[]')
			return serverconfig.features.gdcGenes as string[]
		}

		// disable when caching is incomplete (particularly cases with gene exp data); to prevent showing wrong data on client
		if (!ds.__gdc.doneCaching) throw 'The server has not finished caching the case IDs: try again in ~2 minutes'

		// based on current cohort, get list of cases with exp data, as input of next api query
		const caseLst = await gdcGetCasesWithExressionDataFromCohort(q, ds)
		if (caseLst.length == 0) {
			// there are no cases with gene exp data
			return [] as string[]
		}

		// change to this when api is available on prod
		const url = path.join(geneExpHost, '/gene_expression/gene_selection')

		try {
			const response = await got.post(url, {
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(getGeneSelectionArg(q, caseLst))
			})

			const re = JSON.parse(response.body)
			// {"gene_selection":[{"gene_id":"ENSG00000141510","log2_uqfpkm_median":3.103430497010492,"log2_uqfpkm_stddev":0.8692021350485105,"symbol":"TP53"}, ... ]}

			const genes = [] as string[]
			if (!Array.isArray(re.gene_selection)) throw 're.gene_selection[] is not array'
			for (const i of re.gene_selection) {
				if (i.gene_id && typeof i.gene_id == 'string') {
					// is ensg, convert to symbol
					const t = genome.genedb.getNameByAlias.get(i.gene_id)
					if (t) genes.push(t.name) // ensg
				} else if (i.symbol && typeof i.symbol == 'string') {
					genes.push(i.symbol)
				} else {
					throw 'one of re.gene_selection[] is missing both gene_id and symbol'
				}
			}
			return genes
		} catch (e: any) {
			console.log(e.stack || e)
			throw e
		}
	}

	function getGeneSelectionArg(q: any, caseLst: any) {
		//to hide messy logic during testing phase

		/* when api performance issue is resolved, return this
		return {
			case_ids: caseLst,
			gene_type:'protein_coding',
			selection_size: Number(q.maxGenes)
		}
		*/

		//////////////////////////////////////////////////
		//
		// !!!!!!!!!!!!!!!! TEMPORARY !!!!!!!!!!!!!!!!!!!!
		//
		//////////////////////////////////////////////////
		// limit the case_ids length, and restrict pool to CGC genes, otherwise the request times out !!!
		// must revert asap
		return {
			case_ids: caseLst, //.slice(0, 20),
			gene_ids: tempGetCGCgenes(genome),
			selection_size: Number(q.maxGenes)
		}
	}
}

function tempGetCGCgenes(genome: any) {
	const lst = [] as string[] // list of ENSG ids from cgc genes
	// don't think there's need to preparse genome.geneset, as this function is only temporary
	for (const s of genome.geneset[0].lst) {
		const a = genome.genedb.getAliasByName.all(s)
		if (a) {
			for (const b of a) {
				if (b.alias.startsWith('ENSG')) lst.push(b.alias)
			}
		}
	}
	return lst
}
