import {
	TermdbTopVariablyExpressedGenesRequest,
	TermdbTopVariablyExpressedGenesResponse
} from '#shared/types/routes/termdb.topVariablyExpressedGenes.ts'
import { gdcGetCasesWithExressionDataFromCohort, apihost, geneExpHost } from '../src/mds3.gdc.js'
import path from 'path'
import got from 'got'
import serverconfig from '#src/serverconfig.js'

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
			const genes = await ds.queries.topVariablyExpressedGenes.getGenes(q)
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
	} else {
		nativeValidateQuery(ds, genome)
	}
	// added getter: q.getGenes()
}

function nativeValidateQuery(ds: any, genome: any) {
	ds.queries.topVariablyExpressedGenes.getGenes = async (
		q: TermdbTopVariablyExpressedGenesRequest,
		ds: any,
		genome: any
	) => {
		// get list of samples that are used in current analysis
		const samples = [] as string[]
		// call rust to compute top genes on these samples
		const genes = await computeGenes4nativeDs(q, ds, samples)
		return genes
	}
}

async function computeGenes4nativeDs(q: TermdbTopVariablyExpressedGenesRequest, ds: any, samples: string[]) {
	return []
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
			case_ids: caseLst.slice(0, 20),
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
