import { GdcTopVariablyExpressedGenesResponse } from '#shared/types/routes/gdc.topVariablyExpressedGenes.ts'
import { getCasesWithExressionDataFromCohort } from '../src/mds3.gdc.js'
import path from 'path'
import got from 'got'
import serverconfig from '#src/serverconfig.js'

// TODO change when api is released to prod
//const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const apihost = 'https://uat-portal.gdc.cancer.gov/auth/api/v0/gene_expression/gene_selection'
// temporarily hardcode to use the direct API URL,
// previously hardcoded to use 'https://uat-portal.gdc.cancer.gov/auth/api/v0/'
const geneExpHost = 'https://uat-api.gdc.cancer.gov'

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export const api = {
	endpoint: 'gdc/topVariablyExpressedGenes',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						// following logic requires hg38 gdc dataset
						const genome = genomes[gdcGenome]
						if (!genome) throw 'hg38 genome missing'
						const ds = genome.datasets?.[gdcDslabel]
						if (!ds) throw 'gdc dataset missing'
						const genes = await getGenes(req.query, ds, genome)
						const payload = { genes } as GdcTopVariablyExpressedGenesResponse
						res.send(payload)
					} catch (e: any) {
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: null
				//valid: default to type checker
			},
			response: {
				typeId: 'GdcTopVariablyExpressedGenesResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

/*
req.query {
	filter0 // optional gdc GFF cohort filter, invisible and read only
		FIXME should there be pp filter too?
	maxGenes: int
}

ds { } // server-side ds object

genome {}
*/
async function getGenes(q: any, ds: any, genome: any) {
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
				//gene_ids: [] // this should not be a required parameter
				gene_type: 'protein_coding',
				selection_size: Number(q.maxGenes || 100)
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
	} catch (e) {
		console.log(e.stack || e)
		throw e
	}
}
