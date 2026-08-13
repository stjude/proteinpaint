import { mclass } from './common.js'

/*
tw.q.variantFilter of a geneVariant termwrapper, i.e. the per-row variant filter
that lets two rows of the same gene, e.g. KRAS G12D and KRAS G12V, each show only
its own variants. Only meaningful for q.type='values'; a groupset assigns samples
to named groups instead and does its own filtering server-side.

!!! NOTE !!!
The tvs filters on the server decide whether a *sample* passes. This one decides
whether a single *variant of a sample* is shown by the row it is filtered on, so
it is applied per value of an annotation and not per sample. Anything that can
only be answered by looking at a sample as a whole, e.g. how many mutations it
has, is rejected by validateVariantFilter() rather than silently ignored.

The filter reuses the tvs shape that the variant config UI already emits for a
groupset group, so that the same UI can be wired to it: leaf items are tvs on the
child dt terms of the geneVariant term, whose tvs.values[] entries are
{ key: <mutation class>, mname?: <amino acid change>, gene? }.
*/

/** a mutation class that is a per-dt testing status rather than a variant:
 * WT = tested, no mutation of this dt; Blank = not tested for this dt */
const statusClasses = new Set(['WT', 'Blank'])

/** a leaf of a variant filter is a tvs on a child dt term of the geneVariant term */
type VariantTvs = {
	term: { dt: number; origin?: string; [k: string]: any }
	values: { key: string; mname?: string; gene?: string; [k: string]: any }[]
	isnot?: boolean
	[k: string]: any
}

export type VariantFilter = {
	type: 'tvslst'
	in?: boolean
	join?: string
	lst: ({ type: 'tvs'; tvs: VariantTvs } | VariantFilter)[]
}

/** a variant of a sample, as returned for a geneVariant term */
type VariantValue = {
	dt: number
	class: string
	mname?: string
	gene?: string
	origin?: string
	[k: string]: any
}

function unsupported(what: string) {
	return (
		`tw.q.variantFilter does not support ${what}, which qualifies a sample rather than an individual variant. ` +
		`Use a groupset (q.type='custom-groupset') for a sample-level filter.`
	)
}

/*
Validate a variant filter, throwing on anything that cannot be honored one
variant at a time. Called when filling a tw, so that a bad filter fails at plot
creation with a usable message instead of quietly showing the wrong variants.

filter: tw.q.variantFilter
term: the geneVariant tw.term, to check the filtered dts against its child dt
      terms. optional, as term.childTerms[] may not be filled in yet
*/
export function validateVariantFilter(filter: any, term?: any): void {
	if (!filter) return
	if (filter.type != 'tvslst') throw `tw.q.variantFilter.type must be 'tvslst'`
	if (!Array.isArray(filter.lst) || !filter.lst.length) throw 'tw.q.variantFilter.lst[] is empty'
	if (filter.lst.length > 1 && filter.join != 'and' && filter.join != 'or')
		throw `tw.q.variantFilter.join must be 'and' or 'or' when lst[] has more than one item`
	const dts = term?.childTerms?.length ? new Set(term.childTerms.map((t: any) => t.dt)) : null
	for (const item of filter.lst) {
		if (item.type == 'tvslst') {
			validateVariantFilter(item, term)
			continue
		}
		if (item.type != 'tvs') throw `unexpected tw.q.variantFilter item.type='${item.type}'`
		const tvs = item.tvs
		if (!tvs) throw 'missing tvs of a tw.q.variantFilter item'
		if (!Number.isInteger(tvs.term?.dt)) throw 'tw.q.variantFilter tvs.term must be a dt term, with an integer .dt'
		if (dts && !dts.has(tvs.term.dt))
			throw `tw.q.variantFilter tvs.term.dt=${tvs.term.dt} is not a dt of term '${term.name}'`
		if (!Array.isArray(tvs.values) || !tvs.values.length) throw 'tw.q.variantFilter tvs.values[] is empty'
		for (const v of tvs.values) {
			if (!v.key) throw 'a tw.q.variantFilter tvs.values[] entry is missing .key'
			if (statusClasses.has(v.key))
				throw `tw.q.variantFilter cannot select the '${v.key}' class, which is a testing status and not a variant`
			if (v.partnerBreakpointRange) throw unsupported('partnerBreakpointRange')
		}
		// these tvs props qualify a sample by counting or comparing across its
		// mutations, or by data that a matrix annotation does not carry
		if (tvs.genotype && tvs.genotype != 'variant') throw unsupported(`genotype='${tvs.genotype}'`)
		if (tvs.mcount && tvs.mcount != 'any') throw unsupported(`mcount='${tvs.mcount}'`)
		if (tvs.mafFilter) throw unsupported('mafFilter')
		if (tvs.continuousCnv) throw unsupported('continuousCnv')
		if (tvs.selfBreakpointRange) throw unsupported('selfBreakpointRange')
	}
}

/** the dts, and origins when a leaf is origin-specific, that a filter covers.
 * a row shows only what its filter names, so a value of an uncovered dt is not
 * rendered by that row at all */
function getFilterScope(filter: any, scope = new Set<string>()): Set<string> {
	for (const item of filter.lst) {
		if (item.type == 'tvslst') getFilterScope(item, scope)
		else scope.add(`${item.tvs.term.dt}:${item.tvs.term.origin || '*'}`)
	}
	return scope
}

function isInScope(v: VariantValue, scope: Set<string>): boolean {
	return scope.has(`${v.dt}:*`) || scope.has(`${v.dt}:${v.origin || ''}`)
}

function matchTvs(v: VariantValue, tvs: VariantTvs): boolean {
	let match = false
	if (v.dt == tvs.term.dt && (!tvs.term.origin || v.origin == tvs.term.origin)) {
		/* an entry without .mname matches any variant of its class; with .mname
		(e.g. "G12D") it matches only that amino acid change, further restricted to
		.gene when set, for a term over a gene set. mirrors filterByItem() in
		server/src/mds3.init.js, so that the same tvs means the same thing on both
		sides */
		match = tvs.values.some(
			e => e.key == v.class && (!e.mname || (e.mname == v.mname && (!e.gene || e.gene == v.gene)))
		)
	}
	return tvs.isnot ? !match : match
}

function matchFilter(v: VariantValue, filter: any): boolean {
	const lst = filter.type == 'tvslst' ? filter.lst : [filter]
	let numMatched = 0
	for (const item of lst) {
		const matched = item.type == 'tvslst' ? matchFilter(v, item) : matchTvs(v, item.tvs)
		if (matched) numMatched++
		if (filter.join == 'or' && numMatched) break
	}
	const pass = filter.join == 'or' ? numMatched > 0 : numMatched == lst.length
	return filter.in === false ? !pass : pass
}

/*
Return the values of a geneVariant annotation that the filtered row shows.
Does not mutate the input array or its entries.

values: anno.values[] of one sample for one geneVariant term
filter: tw.q.variantFilter, already validated

- a value of a dt that the filter does not name is dropped: a row shows only the
  dts that its filter covers, so that e.g. a KRAS G12D row does not also render
  that sample's KRAS CNV
- a WT or Blank value is a per-dt testing status and not a variant, so it is kept
  as-is for every covered dt
- when a covered dt had variants but none of them matched, the sample was tested
  and simply does not carry what the row asks for, so it is annotated as wildtype
  for that dt. Without this a KRAS G12V sample would render as an empty, i.e.
  untested, cell in a KRAS G12D row
*/
export function filterVariantValues(values: VariantValue[], filter: any): VariantValue[] {
	if (!filter || !values) return values
	const scope = getFilterScope(filter)
	const kept: VariantValue[] = []
	/** covered dt+origin that already reads as tested, either by a WT/Blank status
	 * or by a matching variant */
	const annotated = new Set<string>()
	/** covered dt+origin whose variants were all dropped, k: dt+origin,
	 * v: one of the dropped values, to copy the shared props from */
	const dropped = new Map<string, VariantValue>()
	for (const v of values) {
		if (!isInScope(v, scope)) continue
		const key = `${v.dt}:${v.origin || ''}`
		if (statusClasses.has(v.class) || matchFilter(v, filter)) {
			kept.push(v)
			annotated.add(key)
		} else if (!dropped.has(key)) {
			dropped.set(key, v)
		}
	}
	for (const [key, v] of dropped) {
		if (annotated.has(key)) continue
		const wt: VariantValue = { dt: v.dt, class: 'WT', label: mclass.WT.label }
		if (v.gene) wt.gene = v.gene
		if (v.origin) wt.origin = v.origin
		kept.push(wt)
	}
	return kept
}

/*
A short label for what a filter selects, to distinguish rows of the same gene.
Prefers the amino acid changes, e.g. "G12D/G12V", and falls back to the mutation
class labels. Only the selected, i.e. not negated, entries are named; returns an
empty string when there is nothing nameable, in which case the caller should keep
the plain term name.

mclassOverride: dataset/chart-level mclass overrides, see the comment in
                client/plots/matrix/matrix.js
*/
export function variantFilterLabel(filter: any, mclassOverride?: { [k: string]: any }, maxItems = 3): string {
	if (!filter) return ''
	const entries: { key: string; mname?: string }[] = []
	collect(filter)
	function collect(f: any) {
		for (const item of f.lst) {
			if (item.type == 'tvslst') collect(item)
			else if (!item.tvs.isnot) entries.push(...item.tvs.values)
		}
	}
	if (!entries.length) return ''
	const classes = mclass as { [k: string]: any }
	const names = entries.every(e => e.mname)
		? [...new Set(entries.map(e => e.mname as string))]
		: [...new Set(entries.map(e => mclassOverride?.[e.key]?.label || classes[e.key]?.label || e.key))]
	return names.length > maxItems ? `${names.slice(0, maxItems).join('/')}…` : names.join('/')
}
