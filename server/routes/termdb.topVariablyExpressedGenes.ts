import type { TermdbTopVariablyExpressedGenesRequest, TermdbTopVariablyExpressedGenesResponse, RouteApi } from '#types'
import { termdbTopVariablyExpressedGenesPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import { get_samples } from '#src/termdb.sql.js'
import { makeFilter } from '#src/mds3.gdc.js'
import { cachedFetch } from '#src/utils.js'
import { joinUrl } from '#shared/joinUrl.js'
import { formatElapsedTime } from '#shared/time.js'
import { mayLog } from '#src/helpers.ts'

export const api: RouteApi = {
	endpoint: 'termdb/topVariablyExpressedGenes',
	methods: {
		get: {
			...termdbTopVariablyExpressedGenesPayload,
			init
		},
		post: {
			...termdbTopVariablyExpressedGenesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		let result
		try {
			const q: TermdbTopVariablyExpressedGenesRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.queries?.topVariablyExpressedGenes) throw 'not supported on dataset'

			const t = Date.now()
			result = {
				genes: await ds.queries.topVariablyExpressedGenes.getGenes(q)
			}

			mayLog('topVariablyExpressedGenes', formatElapsedTime(Date.now() - t))
		} catch (e: any) {
			result = { status: e.status || 400, error: e.message || e }
		}

		res.send(result satisfies TermdbTopVariablyExpressedGenesResponse)
	}
}

export function validate_query_TopVariablyExpressedGenes(ds: any, genome: any) {
	const q = ds.queries.topVariablyExpressedGenes
	if (!q) return
	if (q.src == 'gdcapi') {
		gdcValidateQuery(ds, genome)
	} else if (q.src == 'native') {
		nativeValidateQuery(ds)
	} else {
		throw 'unknown topVariablyExpressedGenes.src'
	}
	// added getter: q.getGenes()
}

function nativeValidateQuery(ds: any) {
	const gE = ds.queries.geneExpression // a separate query required to supply data for computing top genes
	if (!gE) throw 'topVariablyExpressedGenes query given but geneExpression missing'
	if (gE.src != 'native') throw 'topVariablyExpressedGenes is native but geneExpression.src is not native'

	addTopVEarg(ds.queries.topVariablyExpressedGenes)

	ds.queries.topVariablyExpressedGenes.getGenes = async (q: TermdbTopVariablyExpressedGenesRequest) => {
		// get list of samples that are used in current analysis; gE.samples[] contains all sample integer ids with exp data
		const samples = [] as string[]
		if (q.filter) {
			// get all samples pasing pp filter, may contain those without exp data
			const sidlst = await get_samples(q, ds)
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

		// new-format H5 file?
		let newformat = false
		if ('newformat' in gE) {
			newformat = gE.newformat
		}

		// call rust to compute top genes on these samples
		const genes = await computeGenes4nativeDs(q, gE.file, samples, newformat)
		return genes
	}
}

function addTopVEarg(q: any) {
	/** These are hardcoded, universal arguments for top variably expressed genes query using any native datasets
more importantly, this query for all native ds are carried out by the same rust code
thus they are not repeated in individual ds js files, but are dynamically assigned here on server launch
ds can optionally provide overrides, e.g. to account for different exp value metrics
 */
	const arglst = [
		{ id: 'maxGenes', label: 'Gene Count', type: 'number', value: 100 },
		{
			id: 'filter_extreme_values',
			label: 'Filter Extreme Values',
			type: 'boolean',
			value: true,
			options: [
				{
					id: 'min_count',
					label: 'Min count',
					type: 'number',
					value: 10
				},
				{
					id: 'min_total_count',
					label: 'Min total count',
					type: 'number',
					value: 15
				}
			]
		},
		{
			id: 'rank_type',
			label: 'Rank by:',
			type: 'radio',
			options: [
				/** The param option in input JSON is very important.
				 * It instructs what method will be used to calculate variation in the counts for a particular gene.
				 * It supports variance as well as interquartile region.
				 * This is based on the recommendation of this article:
				 * https://www.frontiersin.org/articles/10.3389/fgene.2021.632620/full.
				 * This article recommends using interquartile region over variance.*/
				{
					type: 'boolean',
					label: 'Variance',
					value: 'var'
				},
				{
					type: 'boolean',
					label: 'Interquartile Region',
					value: 'iqr'
				}
			]
		}
	]

	if (q.arguments) {
		// dataset provides overrides. apply to arguments[]
		for (const a of q.arguments) {
			if (!a.id) throw 'missing id of topVE.arguments[]'
			const item = arglst.find(i => i.id == a.id)
			if (!item) throw 'unknown id of topVE.arguments[]'
			Object.assign(item, a) // apply override from a to item
		}
	}
	q.arguments = arglst
}

async function computeGenes4nativeDs(
	q: TermdbTopVariablyExpressedGenesRequest,
	matrixFile: string,
	samples: string[],
	newformat: boolean
) {
	const input_json = {
		input_file: matrixFile,
		samples: samples.join(','),
		filter_extreme_values: q.filter_extreme_values,
		num_genes: q.maxGenes,
		rank_type: q.rank_type?.type
	}

	if (q.filter_extreme_values == 1) {
		input_json['min_count'] = q.min_count
		input_json['min_total_count'] = q.min_total_count
	}

	// Handle new-format H5 file
	if (newformat) {
		input_json['newformat'] = true
	}

	const rust_output = await run_rust('topGeneByExpressionVariance', JSON.stringify(input_json))
	const rust_output_list = rust_output.split('\n')

	let output_json
	for (const item of rust_output_list) {
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
			console.error(
				'!!GDC!! using serverconfig.features.gdcGenes[] but not live api query. only use this on DEV and never on PROD!'
			)
			return serverconfig.features.gdcGenes as string[]
		}

		// TODO: generalize to any dataset
		if (ds.label === 'GDC' && !ds.__gdc?.doneCaching) {
			// disable when caching is incomplete (particularly cases with gene exp data); to prevent showing wrong data on client
			throw 'The server has not finished caching the case IDs: try again in about 2 minutes.'
		}
		const { host, headers } = ds.getHostHeaders(q)
		try {
			// cachedFetch will only cache a response if an external API URL is enabled in serverconfig.features.extApiCache
			const response = await cachedFetch(
				joinUrl(host.rest, '/gene_expression/gene_selection'),
				{
					method: 'POST',
					headers,
					body: getGeneSelectionArg(q)
				},
				{
					// noCache: true, // !!! for testing only !!!
					getErrMessage: response => {
						// TODO: may detect empty response or response body beforehand in utils:cachedFetch()
						const body = response?.body || response
						// no error message if there is a gene_selection array in the response payload
						return Array.isArray(body?.gene_selection) ? '' : body?.message || body?.error || JSON.stringify(body)
					}
				}
			)

			const re = response.body
			// {"gene_selection":[{"gene_id":"ENSG00000141510","log2_uqfpkm_median":3.103430497010492,"log2_uqfpkm_stddev":0.8692021350485105,"symbol":"TP53"}, ... ]}

			const genes = [] as string[]
			if (!Array.isArray(re.gene_selection)) {
				throw 're.gene_selection[] is not array: ' + JSON.stringify(re)
			}
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
			console.error(e.stack || e)
			throw e
		}
	}

	function getGeneSelectionArg(q: TermdbTopVariablyExpressedGenesRequest) {
		const arg: any = {
			// add any to avoid tsc err
			case_filters: makeFilter(q),
			selection_size: q.maxGenes,
			min_median_log2_uqfpkm: q.min_median_log2_uqfpkm
		}

		if (q.geneSet) {
			if (q.geneSet.type == 'all') {
				arg.gene_type = 'protein_coding'
			} else if (q.geneSet.type == 'custom' || q.geneSet.type == 'msigdb') {
				if (!Array.isArray(q.geneSet.geneList)) throw 'q.geneSet.geneList is not array'
				arg.gene_ids = map2ensg(q.geneSet.geneList, genome)
				if (arg.gene_ids.length == 0) throw 'no valid genes from custom gene set'
			} else {
				throw 'unknown q.geneSet.type'
			}
		} else {
			arg.gene_type = 'protein_coding'
		}

		return arg
	}
}

function map2ensg(lst: string[], genome: any) {
	const ensg: string[] = []
	for (const name of lst) {
		if (name.startsWith('ENSG') && name.length == 15) {
			ensg.push(name)
			continue
		}
		const tmp: any = genome.genedb.getAliasByName.all(name)
		if (Array.isArray(tmp)) {
			for (const a of tmp) {
				if (a.alias.startsWith('ENSG')) {
					ensg.push(a.alias)
					break
				}
			}
		}
	}
	return ensg
}
