import { GdcTopVariablyExpressedGenesResponse } from '#shared/types/routes/gdc.topVariablyExpressedGenes.ts'
import { getCasesWithExressionDataFromCohort } from '../src/mds3.gdc.js'
//import path from 'path'
import got from 'got'

//const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const apihost = 'https://uat-portal.gdc.cancer.gov/auth/api/v0/gene_expression/gene_selection' // TODO change when api is released to prod

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export const api = {
	endpoint: 'gdc/topVariablyExpressedGenes',
	methods: {
		get: {
			init({ genomes }) {
				/*
				 */

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

*/
async function getGenes(q: any, ds: any, genome: any) {
	// based on current cohort, get list of cases with exp data, as input of next api query
	const caseLst = await getCasesWithExressionDataFromCohort(q, ds)
	if (caseLst.length == 0) {
		// there are no cases with gene exp data
		return [] as string[]
	}

	// change to this when api is available on prod
	// const url = path.join(apihost, '/gene_expression/gene_selection')

	const response = await got.post(apihost, {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			case_ids: caseLst,
			gene_ids: getFullGenelist(genome), // XXX should not be required
			size: q.maxGenes || 100
		})
	})

	const re = JSON.parse(response.body)
	// {"gene_selection":[{"gene_id":"ENSG00000141510","log2_uqfpkm_median":3.103430497010492,"log2_uqfpkm_stddev":0.8692021350485105,"symbol":"TP53"}, ... ]}

	const genes = [] as string[]
	if (!Array.isArray(re.gene_selection)) throw 're.gene_selection[] is not array'
	for (const i of re.gene_selection) {
		if (i.gene_id && typeof i.gene_id == 'string') {
			genes.push(i.gene_id) // ensg
		} else if (i.symbol && typeof i.symbol == 'string') {
			genes.push(i.symbol)
		} else {
			throw 'a return is missing both gene_id and symbol'
		}
	}
	return genes
}

function getFullGenelist(genome) {
	// just for testing only! should not be required. pending discussion with Phil
	// cannot send all 60k ENSG to api, it errors out. can only send 200 or less
	const re = genome.genedb.getAllENSG.all()
	const lst = re.slice(0, 200).map(i => i.alias)
	return lst
}
