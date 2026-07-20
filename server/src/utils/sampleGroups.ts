import type { DERequest, DiffMethRequest } from '#types'
import { getData, maySetMapParent2Children } from '#src/termdb.matrix.js'
import { mayLimitSamples } from '#src/mds3.filter.js'

/** Two-group sample resolution result. The conf{1,2}_group{1,2} arrays
 * carry the confounder values for samples that survived the per-confounder
 * filter (see `buildGroupValues`). `alerts` is non-empty when the resolver
 * detected a structural problem (empty group, overlap, etc.) and the
 * caller should fail the request. Shape is shared between DE and DM and
 * any future two-group analysis with optional confounders. */
export type SampleGroups = {
	group1names: string[]
	group2names: string[]
	conf1_group1: (string | number)[]
	conf1_group2: (string | number)[]
	conf2_group1: (string | number)[]
	conf2_group2: (string | number)[]
	alerts: string[]
}

/** Resolve the dataset + confounder term data for a DE or DM request.
 * Generic over request type — the lookups (genome, tw, tw2, filter,
 * filter0) live on both DERequest and DiffMethRequest with identical
 * semantics. Used both by fresh-compute paths (which need ds for the
 * runner) and by the preAnalysis short-circuit (which needs ds for
 * sample-count derivation). */
export async function resolveDaContext(
	req: DERequest | DiffMethRequest,
	genomes: any
): Promise<{ ds: any; term_results: any; term_results2: any }> {
	const genome = genomes[req.genome]
	if (!genome) throw new Error('invalid genome')
	const ds = genome.datasets?.[req.dslabel]
	if (!ds) throw new Error('invalid dslabel')

	let term_results: any = []
	if (req.tw) {
		term_results = await getData(
			{
				filter: (req as any).filter,
				filter0: (req as any).filter0,
				terms: [req.tw]
			},
			ds,
			true // always map parent annotations to child samples for DA analysis
		)
		if (term_results.error) throw new Error(term_results.error)
	}

	let term_results2: any = []
	if (req.tw2) {
		term_results2 = await getData(
			{
				filter: (req as any).filter,
				filter0: (req as any).filter0,
				terms: [req.tw2]
			},
			ds,
			true // always map parent annotations to child samples for DA analysis
		)
		if (term_results2.error) throw new Error(term_results2.error)
	}

	return { ds, term_results, term_results2 }
}

/** Walk one sample group's values and collect names + confounder values.
 * A name is included iff every configured confounder (tw, tw2) has data
 * for that sample — the two early-return guards enforce that without a
 * nested if/else cascade. Used by both DE and DM resolvers; the per-route
 * wrappers add their own validation + alert messages around this. */
export async function buildGroupValues(
	values: Array<{ sampleId: number }>,
	allSampleSet: Set<string>,
	ds: any,
	tw: any,
	tw2: any,
	term_results: any,
	term_results2: any
): Promise<{ names: string[]; conf1: (string | number)[]; conf2: (string | number)[] }> {
	const names: string[] = []
	const conf1: (string | number)[] = []
	const conf2: (string | number)[] = []
	let sampleLst = values
	if (ds.cohort.termdb.hasSampleAncestry) {
		// ds has sample ancestry
		// data for DE/DM (i.e. genomic data) are assumed to be
		// at sample-level, so map sample ids to sample-level
		const term = {
			type: 'samplelst',
			values: {
				'': { key: '', list: values }
			}
		}
		const filter = {
			type: 'tvslst',
			in: true,
			join: '',
			lst: [{ type: 'tvs', tvs: { term } }]
		}
		const arg = { filter }
		maySetMapParent2Children(arg, ds, true)
		const allSamples = [...allSampleSet].map(sname => ds.cohort.termdb.q.sampleName2id(sname))
		// filtering samples by samplelst term
		// if samples are at parent-level, then will get mapped to sample-level
		// otherwise, samples will be used as is
		const samples = (await mayLimitSamples(arg, allSamples, ds)) || new Set()
		sampleLst = [...samples].map(s => {
			return { sampleId: s }
		})
	}
	for (const s of sampleLst) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n || !allSampleSet.has(n)) continue
		// If a confounder is configured but missing for this sample, skip it.
		if (tw && !term_results.samples?.[s.sampleId]) continue
		if (tw2 && !term_results2.samples?.[s.sampleId]) continue
		if (tw) {
			const v = term_results.samples[s.sampleId][tw.$id]
			conf1.push(tw.q.mode === 'continuous' ? v.value : v.key)
		}
		if (tw2) {
			const v = term_results2.samples[s.sampleId][tw2.$id]
			conf2.push(tw2.q.mode === 'continuous' ? v.value : v.key)
		}
		names.push(n)
	}
	return { names, conf1, conf2 }
}

/** Caller-side normalizer for two-group analyses (DE, DM): returns a
 * `samplelst` copy with each group's `values` sorted by sampleId, so a
 * client sending the same samples in a different order still hashes to
 * the same cacheId. Each route is responsible for calling this (or
 * otherwise guaranteeing sorted order) before passing samplelst into
 * cacheOrRecompute — the cache module trusts its inputs. */
export function canonicalizeSamplelst(s: any): any {
	if (!s || !Array.isArray(s.groups)) return s
	return {
		groups: s.groups.map((g: any) => ({
			name: g.name,
			in: g.in,
			values: Array.isArray(g.values)
				? [...g.values].sort((a, b) => {
						const A = a?.sampleId
						const B = b?.sampleId
						if (A === B) return 0
						return A < B ? -1 : 1
				  })
				: g.values
		}))
	}
}
