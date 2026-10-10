import type { DERequest, DiffMethRequest, DiffSpliceRequest } from '#types'
import { getData, maySetMapParent2Children } from '#src/termdb.matrix.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { filterSampleNamesByAccess, get_samples } from '#src/termdb.sql.js'
import { authApi } from '#src/auth.js'
import { generateHash } from '#src/serverconfig.js'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'

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
	req: DERequest | DiffMethRequest | DiffSpliceRequest,
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
				terms: [req.tw],
				__protected__: req.__protected__
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
				terms: [req.tw2],
				__protected__: req.__protected__
			},
			ds,
			true // always map parent annotations to child samples for DA analysis
		)
		if (term_results2.error) throw new Error(term_results2.error)
	}

	return { ds, term_results, term_results2 }
}

/** Remove sample names containing `pattern` from `allSampleSet`, in place, and return how
 * many went. Lets a dataset withhold a non-comparable specimen type from a two-group
 * analysis by shrinking the eligibility set the analysis already filters through
 * (buildGroupValues below), instead of adding a check to every call site.
 *
 * Returns the count so the caller can be loud about a pattern that matched nothing: a
 * silently-ineffective exclusion is the exact failure this is meant to prevent, and it
 * looks identical to a working one from the outside. No pattern means no filtering. */
export function withholdSampleNames(allSampleSet: Set<string>, pattern?: string): number {
	if (!pattern) return 0
	let withheld = 0
	for (const name of allSampleSet) {
		if (name.includes(pattern)) {
			allSampleSet.delete(name)
			withheld++
		}
	}
	return withheld
}

/* The eligible samples that pass the dataset's sample filter for a request, same as for getData().
Kept per eligible set and per request (its q.__protected__ object), since the groups of one analysis
are resolved in separate buildGroupValues() calls. */
const readableByRequest = new WeakMap<Set<string>, WeakMap<object, Promise<Set<string>>>>()

function readableSamples(allSampleSet: Set<string>, ds: any, __protected__: any): Promise<Set<string>> | Set<string> {
	if (!ds.cohort?.termdb?.getAdditionalFilter) return allSampleSet
	const resolve = async () => new Set<string>(await filterSampleNamesByAccess({ __protected__ }, ds, [...allSampleSet]))
	// there is no request object to keep the result by
	if (!__protected__ || typeof __protected__ != 'object') return resolve()
	let byRequest = readableByRequest.get(allSampleSet)
	if (!byRequest) readableByRequest.set(allSampleSet, (byRequest = new WeakMap()))
	let readable = byRequest.get(__protected__)
	if (!readable) byRequest.set(__protected__, (readable = resolve()))
	return readable
}

/** Walk one sample group's values and collect names + confounder values.
 * A name is included iff every configured confounder (tw, tw2) has data
 * for that sample — the two early-return guards enforce that without a
 * nested if/else cascade. Used by both DE and DM resolvers; the per-route
 * wrappers add their own validation + alert messages around this.
 * `__protected__` is the request's q.__protected__, which a dataset with a
 * sample filter (getAdditionalFilter) requires. */
export async function buildGroupValues(
	values: Array<{ sampleId: number | string }>,
	allSampleSet: Set<string>,
	ds: any,
	tw: any,
	tw2: any,
	term_results: any,
	term_results2: any,
	__protected__?: any
): Promise<{ names: string[]; conf1: (string | number)[]; conf2: (string | number)[] }> {
	const names: string[] = []
	const conf1: (string | number)[] = []
	const conf2: (string | number)[] = []
	let sampleLst = values
	const readable = await readableSamples(allSampleSet, ds, __protected__)

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
		const allSamples = [...readable].map(sname => ds.cohort.termdb.q.sampleName2id(sname))
		// filtering samples by samplelst term
		// if samples are at parent-level then will get
		// mapped to sample-level, otherwise will be used as is
		const samples = (await mayLimitSamples(arg, allSamples, ds)) || new Set()
		sampleLst = [...samples].map(s => {
			return { sampleId: s }
		})
	}

	for (const s of sampleLst) {
		// a string sampleId IS the sample name: api-backed datasets without a sqlite termdb (gdc) key
		// samples by case uuid, which is what getSampleList() hands back for them. an integer id is a
		// termdb row id and still has to be resolved.
		const n =
			typeof s.sampleId == 'string'
				? s.sampleId
				: Number.isInteger(s.sampleId)
				? ds.cohort.termdb.q.id2sampleName(s.sampleId)
				: undefined
		if (!n || !readable.has(n)) continue
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

/** An id of the dataset's sample filter for this request, since buildGroupValues() resolves the
 * groups with it. It is the cacheScope for a result that is computed from sample groups, and is
 * recorded with a result that a later request may name by its cacheId alone, to compare with the
 * scope of that request. Empty when the dataset has no sample filter, or when none applies to
 * the request. */
export function sampleFilterScope(q: { __protected__?: any }, ds: any): string {
	if (!ds?.cohort?.termdb?.getAdditionalFilter) return ''
	const fq: any = { __protected__: q.__protected__ }
	authApi.mayAdjustFilter(fq, ds, undefined)
	return sampleFilterId(fq.filter)
}

/** The id of a dataset's sample filter for a request, as mayAdjustFilter() sets it on a query that
 * had no filter: '' when there is none, which is no filter at all or the empty filter without a tag
 * that mayAdjustFilter() leaves for a request that the dataset does not filter. Any other filter is
 * a sample filter, whatever its shape, and has an id of its own, so that a result for a request with
 * a sample filter is never kept under the scope of the requests without one. */
export function sampleFilterId(filter: any): string {
	if (!filter) return ''
	if (!filter.tag && Array.isArray(filter.lst) && !filter.lst.length) return ''
	return generateHash(filter)
}

/** The sample ids that a filter selects for a request, as the termdb `getsamplelist` query resolves
 * them (getSampleList() in termdb.js), without that query's display checks: the ids are for the
 * server's own use. The dataset's sample filter is merged in as getData() does, and the sample
 * level of the ids is set as getData() sets it for a filter. `fq` is modified. */
async function filterToSampleIds(fq: any, ds: any, mapParent2Children?: boolean): Promise<(number | string)[]> {
	authApi.mayAdjustFilter(fq, ds, undefined)
	// a dataset's own filterSamples() may read the dataset from the query, as getData() gives it
	fq.ds = ds
	maySetMapParent2Children(fq, ds, mapParent2Children)
	if (ds.cohort?.db) {
		// get_samples() may repeat an id
		return [...new Set<number>((await get_samples(fq, ds)).map((i: any) => i.id))]
	}
	const filterSamples = ds.cohort?.termdb?.filterSamples
	if (typeof filterSamples == 'function') {
		/* the dataset's own method, as the getsamplelist query uses it. a method may leave some kinds
		of term out of what it resolves, see hasFilterTermsUnsupportedByFilterSamples() in termdb.matrix.ts */
		return [...((await filterSamples(fq, ds, true)) ?? [])]
	}
	throw new Error('no method available to get the samples of a group')
}

/** The most groups defined by a filter that one call of resolveGroups() takes: more than are made by
 * hand in a groups UI. */
export const maxFilterGroups = 50

/** A group that is defined by a filter and lists no samples. */
export const isFilterGroup = (g: any) => !Array.isArray(g?.values) && !!g?.filter && typeof g.filter == 'object'

/** Sample groups, of a samplelst term or of a two-group analysis, with their samples listed.
 * A group either lists its samples in `values`, and is returned as it is, or is defined by a
 * `filter`, and is returned as a copy with the `values` that the filter selects for this request
 * and without the filter. The request's groups are not modified, so that a cache key made from
 * them is the same before and after.
 *
 * The list of a filter is kept in the samplelst cache, by the filter and by the dataset's sample
 * filter for the request (sampleFilterScope). Its cacheId is not part of any response.
 * `q` is the request: its __protected__ is used, and its filter0 for a group that carries none.
 * A group carries the filter0 that it was made with, so that every request resolves it the same,
 * whether or not the request has a filter0 of its own.
 *
 * The filter groups of a call are resolved one at a time, so that a request has one lookup of the
 * samplelst cache pending at a time, and a call takes up to maxFilterGroups of them. getData()
 * holds the samplelst terms of a request to that limit together. */
export async function resolveGroups(groups: any, q: any, ds: any): Promise<any[]> {
	if (!Array.isArray(groups)) throw new Error('sample groups are not an array')
	const filterGroupCount = groups.filter(isFilterGroup).length
	if (!filterGroupCount) return groups
	if (filterGroupCount > maxFilterGroups) throw new Error('too many sample groups defined by a filter')
	const cacheScope = sampleFilterScope(q, ds)
	const resolved: any[] = []
	for (const g of groups) {
		if (!isFilterGroup(g)) {
			// a group with neither is left to the checks of its reader
			resolved.push(g)
			continue
		}
		const { filter, filter0: groupFilter0, ...rest } = g
		// null is a filter0 too: the group was made with none
		const filter0 = groupFilter0 !== undefined ? groupFilter0 : q.filter0
		const { result } = await cacheOrRecompute<any, (number | string)[]>({
			cacheSubdir: 'samplelst',
			computeArgument: {
				genome: ds.genomename,
				dslabel: ds.label,
				filter,
				filter0,
				mapParent2Children: g.mapParent2Children
			},
			cacheScope,
			computeFresh: () =>
				filterToSampleIds(
					{ filter: structuredClone(filter), filter0, __protected__: q.__protected__ },
					ds,
					g.mapParent2Children
				)
		})
		resolved.push({ ...rest, in: true, values: result.map(sampleId => ({ sampleId })) })
	}
	return resolved
}

/** A two-group analysis request with the samples of its samplelst groups listed, for a cache key
 * that is made from the samples of the groups: the result of an analysis is then kept for the
 * samples that it was run on, and not for a filter whose samples may change. The request is
 * returned as it is when no group is defined by a filter, and is not modified. */
export async function withResolvedGroups<T extends { samplelst?: any }>(req: T, ds: any): Promise<T> {
	if (!ds || !Array.isArray(req.samplelst?.groups)) return req // left to the checks of the analysis
	const groups = await resolveGroups(req.samplelst.groups, req, ds)
	return groups === req.samplelst.groups ? req : { ...req, samplelst: { ...req.samplelst, groups } }
}

/** The two sample lists of a request that names its groups as `group1` and `group2`, each an
 * array of {sampleId} or a group defined by a filter, see resolveGroups(). */
export async function resolveGroupPair(q: any, ds: any): Promise<[any, any]> {
	const asGroup = (v: any) => (Array.isArray(v) ? { values: v } : v)
	const [g1, g2] = await resolveGroups([asGroup(q.group1), asGroup(q.group2)], q, ds)
	return [g1?.values, g2?.values]
}

/** Caller-side normalizer for two-group analyses (DE, DM): returns a
 * `samplelst` copy with each group's `values` sorted by sampleId, so a
 * client sending the same samples in a different order still hashes to
 * the same cacheId. A group defined by a filter keeps the filter, since
 * that is what tells it from another group; DE and DM list the samples of
 * such a group first, see withResolvedGroups(). Each route is responsible for
 * calling this (or otherwise guaranteeing sorted order) before passing
 * samplelst into cacheOrRecompute — the cache module trusts its inputs. */
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
				: g.values,
			...(isFilterGroup(g) ? { filter: g.filter, filter0: g.filter0, mapParent2Children: g.mapParent2Children } : {})
		}))
	}
}
