import type { TermdbTopVariablyExpressedGenesRequest, TermdbTopVariablyExpressedGenesResponse, RouteApi } from '#types'
import { termdbTopVariablyExpressedGenesPayload } from '#types/checkers'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import type { TopVeCacheResult } from './types.ts'

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
			q.ds = ds // helps ds getter

			const t = Date.now()
			result = {
				genes: await ds.queries.topVariablyExpressedGenes.getGenes(q)
			}
			mayLog('Time for top variably expressed genes', formatElapsedTime(Date.now() - t))
		} catch (e: any) {
			result = { status: e.status || 400, error: e.message || e }
		}

		res.send(result satisfies TermdbTopVariablyExpressedGenesResponse)
	}
}

export function validate_query_TopVariablyExpressedGenes(ds: any) {
	const q = ds.queries.topVariablyExpressedGenes
	if (!q) return
	if (typeof q.getGenes == 'function') return // ds-supplied
	nativeValidateQuery(ds)
}

function nativeValidateQuery(ds: any) {
	const gE = ds.queries.geneExpression // a separate query required to supply data for computing top genes
	if (!gE) throw 'topVariablyExpressedGenes query given but geneExpression missing'
	if (gE.src != 'native') throw 'topVariablyExpressedGenes is native but geneExpression.src is not native'

	addTopVEarg(ds.queries.topVariablyExpressedGenes)

	ds.queries.topVariablyExpressedGenes.getGenes = async (q: TermdbTopVariablyExpressedGenesRequest) => {
		const { result } = await cacheOrRecompute<ReturnType<typeof topVeKeyInputs>, TopVeCacheResult>({
			computeArgument: topVeKeyInputs(q),
			cacheSubdir: 'topve',
			computeFresh: async () => {
				const samples = await resolveNativeSamples(q, gE, ds)
				const genes = await computeGenes4nativeDs(q, gE, samples)
				const cacheResult: TopVeCacheResult = { genes }
				return cacheResult
			}
		})
		return result.genes
	}
}

/** The subset of a TopVE request that determines the cache identity.
 * Hash raw filter inputs (not resolved sample lists) to keep cache-hit
 * work to zero — equivalent filters resolving to the same samples just
 * don't share cache. Mirrors the DE/DM pattern. */
function topVeKeyInputs(q: TermdbTopVariablyExpressedGenesRequest) {
	return {
		genome: q.genome,
		dslabel: q.dslabel,
		maxGenes: q.maxGenes,
		filter_extreme_values:
			typeof q.filter_extreme_values === 'number' ? Boolean(q.filter_extreme_values) : !!q.filter_extreme_values,
		rank_type: q.rank_type?.type ?? 'var',
		filter: (q as any).filter ?? null,
		filter0: (q as any).filter0 ?? null
	}
}

async function resolveNativeSamples(q: TermdbTopVariablyExpressedGenesRequest, gE: any, ds: any): Promise<string[]> {
	const samples: string[] = []
	const limitSamples = await mayLimitSamples({ filter: q.filter, filter0: q.filter0 }, gE.samples, ds)
	const sourceIds = limitSamples ?? gE.samples
	for (const sid of sourceIds) {
		const n: string = ds.cohort.termdb.q.id2sampleName(sid)
		if (!n) throw 'sample id cannot convert to string name'
		samples.push(n)
	}
	return samples
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
			value: true
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

async function computeGenes4nativeDs(q: TermdbTopVariablyExpressedGenesRequest, gE: any, samples: string[]) {
	if (!['number', 'boolean'].includes(typeof q.filter_extreme_values) || q.filter_extreme_values === undefined) {
		q.filter_extreme_values = false
	}
	const input_json = {
		input_file: gE.file,
		samples: samples.join(','),
		filter_extreme_values:
			typeof q.filter_extreme_values === 'number' ? Boolean(q.filter_extreme_values) : q.filter_extreme_values,
		max_genes: q.maxGenes,
		rank_type: q.rank_type?.type ?? 'var'
	}

	const python_output = await run_python('topVEgene.py', JSON.stringify(input_json))
	const varGenes: string[] = typeof python_output === 'string' ? JSON.parse(python_output) : []
	return varGenes
}
