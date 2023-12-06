import {
	GdcTopVariablyExpressedGenesRequest,
	GdcTopVariablyExpressedGenesResponse
} from '#shared/types/routes/gdc.topVariablyExpressedGenes.ts'
import { getCasesWithExressionDataFromCohort } from '../src/mds3.gdc.js'
import path from 'path'
import got from 'got'
import serverconfig from '#src/serverconfig.js'

// TODO make it general purpose based on ds.queries.geneExpression.topVariablyExpressedGenes{}; wait till case/gene link changes are done
// https://github.com/NCI-GDC/gdcapi/blob/develop/openapi/gene-expression.yaml
const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
// may override the geneExpHost for developers without access to qa/portal environments
const geneExpHost = serverconfig.features?.geneExpHost || apihost

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export const api = {
	endpoint: 'gdc/topVariablyExpressedGenes',
	methods: {
		get: {
			init,
			request: {
				typeId: 'GdcTopVariablyExpressedGenesRequest'
			},
			response: {
				typeId: 'GdcTopVariablyExpressedGenesResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			// following logic requires hg38 gdc dataset
			const genome = genomes[gdcGenome]
			if (!genome) throw 'hg38 genome missing'
			const ds = genome.datasets?.[gdcDslabel]
			if (!ds) throw 'gdc dataset missing'
			const genes = await getGenes(req.query as GdcTopVariablyExpressedGenesRequest, ds, genome)
			const payload = { genes } as GdcTopVariablyExpressedGenesResponse
			res.send(payload)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

/*
 */
async function getGenes(q: GdcTopVariablyExpressedGenesRequest, ds: any, genome: any) {
	if (serverconfig.features.gdcGenes) {
		// for testing only; delete when api issue is resolved
		return serverconfig.features.gdcGenes as string[]
	}
	if (!ds.__gdc.doneCaching) {
		throw `The server has not finished caching the case IDs: try again in ~2 minutes`
	}

	// based on current cohort, get list of cases with exp data, as input of next api query
	const caseLst = await getCasesWithExressionDataFromCohort(q, ds)
	if (caseLst.length == 0) {
		// there are no cases with gene exp data
		return [] as string[]
	}

	// change to this when api is available on prod
	const url = path.join(geneExpHost, '/gene_expression/gene_selection')

	try {
		const response = await got.post(url, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				// !!! temporarily limit the case_ids length, otherwise the request times out !!!
				case_ids: caseLst.slice(0, 20),

				// temporary!! restrict pool to cgc due to slow api. delete when new api is online
				gene_ids: tempGetCGCgenes(genome),

				// when gene_ids is deleted, enable this
				//gene_type: 'protein_coding',

				selection_size: Number(q.maxGenes) // FIXME it's defined as number but why it's string??
			})
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
