import type {
	RoutePayload,
	RouteApi,
	SunburstRequest,
	SunburstResponse,
	SunburstNode,
	SunburstCategory,
	Filter
} from '#types'
import { getData } from '#src/termdb.matrix.js'
import { get_active_groupset } from '#src/termdb.sql.js'
import { isNumericTerm, getTwSampleTypes } from '#shared/terms.js'
import { validGenomeDs } from './common.ts'
import { genomes } from '#src/initGenomesDs.js'

/*
nested sample counts for the sunburst chart: one ring per term wrapper, each wedge a category (or bin)
of its ring's term under its parent wedge's category. A sample with no value for a ring ends at the
previous ring, so a wedge can be larger than the sum of its children. Only counts are returned, with
the tvs fields that select each category, so the client can turn a wedge path into a group filter
without seeing any sample.

In a dataset with a sample hierarchy (e.g. patient > primary, PDX and CSF samples), values map only from a
parent sample to its children, so the rings' terms must lie on one line of descent: patient terms with
the terms of one sample type. The deepest of their types is the counted unit; a sample of another type
that passes the filter cannot have a value for that ring, so it is not counted.
*/

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.cohort.termdb.sunburst
	get init() {
		return hasSunburstDs(genomes) ? init : null
	},
	request: { typeId: 'SunburstRequest' },
	response: { typeId: 'SunburstResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/sunburst',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasSunburstDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.cohort?.termdb?.sunburst)
	)
}

const MAX_RINGS = 20

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: SunburstRequest = { ...req.query, ...validGenomeDs(req.query) }
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.cohort?.termdb?.sunburst) throw 'sunburst not supported on this dataset'
			validateTwLst(q.twLst)
			res.send(await getSunburst(q, ds))
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			res.send({ error: e?.message || e })
		}
	}
}

export function validateTwLst(twLst: any) {
	if (!Array.isArray(twLst) || !twLst.length) throw 'twLst[] must be a non-empty array'
	if (twLst.length > MAX_RINGS) throw `at most ${MAX_RINGS} rings are supported`
	const ids = new Set()
	for (const tw of twLst) {
		if (!tw || typeof tw != 'object' || typeof tw.$id != 'string' || !tw.$id) throw 'each tw must have a $id'
		if (ids.has(tw.$id)) throw `duplicate tw.$id='${tw.$id}'`
		ids.add(tw.$id)
		const type = tw.term?.type
		if (type == 'categorical') continue
		if (!isNumericTerm(tw.term) || !['integer', 'float'].includes(type))
			throw `unsupported ring term type '${type}', must be categorical or numeric`
		if (tw.q?.mode && tw.q.mode != 'discrete' && tw.q.mode != 'binary')
			throw `numeric ring term '${tw.term.id}' must be binned (q.mode=discrete or binary)`
	}
}

/** how one ring's term turns a sample's value into a category, and that category's label, colour,
 *  selecting tvs/filter and sort rank */
type Ring = {
	/** the sample's category key, or undefined when it has no usable value for this term */
	keyOf: (v: any) => string | undefined
	category: (key: string) => SunburstCategory
	/** sort rank of a category; categories without one sort after, by count */
	rank: (key: string) => number | undefined
}

async function getSunburst(q: SunburstRequest, ds: any): Promise<SunburstResponse> {
	const sampleTypes = ds.cohort.termdb.sampleTypes || {}
	const unitType = ds.cohort.termdb.hasSampleAncestry
		? getUnitSampleType(
				q.twLst.map(tw => getTwSampleTypes(tw, ds).sampleTypes?.[0]),
				sampleTypes
		  )
		: undefined
	const data = await getData(
		{
			filter: q.filter,
			filter0: q.filter0,
			terms: q.twLst,
			__protected__: q.__protected__,
			__abortSignal: q.__abortSignal
		},
		ds
	)
	if (data.error) throw data.error
	const rings = q.twLst.map(tw => getRing(tw, data.refs?.byTermId?.[tw.$id]))
	let samples: any[] = Object.values(data.samples || {})
	let unit = data.sampleType
	if (unitType !== undefined && Number.isInteger(sampleTypes[unitType]?.parent_id)) {
		// rings of a sample type, not only of patients: count only samples of that type or below it
		samples = samples.filter(s => {
			const t = ds.sampleId2Type?.get(Number(s.sample))
			return t === undefined || t == unitType || sampleTypeAncestors(t, sampleTypes).includes(unitType)
		})
		unit = sampleTypes[unitType]
	}
	return {
		...nestSamples(samples, q.twLst, rings),
		unit: { one: unit?.name || 'sample', many: unit?.plural_name || 'samples' }
	}
}

/** ids of the ancestor sample types of a sample type, nearest first */
export function sampleTypeAncestors(type: number, sampleTypes: any): number[] {
	const lst: number[] = []
	for (let p = sampleTypes[type]?.parent_id; Number.isInteger(p) && !lst.includes(p); p = sampleTypes[p]?.parent_id)
		lst.push(p)
	return lst
}

/** the deepest of the rings' sample types, which the chart counts; throws when two rings' types are not
 *  on one line of descent (e.g. primary and PDX samples, both children of patient), as no value maps
 *  between them. Undefined when no ring has a known sample type */
export function getUnitSampleType(types: (number | undefined)[], sampleTypes: any): number | undefined {
	const lst = [...new Set(types.filter((t): t is number => Number.isInteger(t)))]
	if (!lst.length) return
	const depth = (t: number) => sampleTypeAncestors(t, sampleTypes).length
	const deepest = lst.reduce((a, b) => (depth(b) > depth(a) ? b : a))
	const line = new Set([deepest, ...sampleTypeAncestors(deepest, sampleTypes)])
	const other = lst.find(t => !line.has(t))
	if (other !== undefined) {
		const name = (t: number) => sampleTypes[t]?.plural_name || `sample type ${t}`
		throw `rings of ${name(deepest)} and ${name(other)} cannot be combined; use terms of one sample type`
	}
	return deepest
}

/** nest the samples by their ring categories into counted wedges */
export function nestSamples(samples: any[], twLst: any[], rings: Ring[]): SunburstResponse {
	type Tmp = { key: string; count: number; children: Map<string, Tmp> }
	const root: Tmp = { key: '', count: 0, children: new Map() }
	let noFirstRingValue = 0
	for (const s of samples) {
		let node = root
		for (const [i, tw] of twLst.entries()) {
			const key = rings[i].keyOf(s[tw.$id])
			if (key === undefined) {
				if (i == 0) noFirstRingValue++
				break
			}
			if (i == 0) root.count++
			let child = node.children.get(key)
			if (!child) {
				child = { key, count: 0, children: new Map() }
				node.children.set(key, child)
			}
			child.count++
			node = child
		}
	}

	const out: SunburstResponse['rings'] = rings.map(() => ({ categories: {} }))
	const convert = (n: Tmp, ringIdx: number): SunburstNode[] => {
		const ring = rings[ringIdx]
		const lst = [...n.children.values()]
		lst.sort((a, b) => {
			const ra = ring.rank(a.key)
			const rb = ring.rank(b.key)
			if (ra !== undefined && rb !== undefined) return ra - rb
			if (ra !== undefined) return -1
			if (rb !== undefined) return 1
			return b.count - a.count
		})
		return lst.map(c => {
			if (!out[ringIdx].categories[c.key]) out[ringIdx].categories[c.key] = ring.category(c.key)
			const node: SunburstNode = { key: c.key, count: c.count }
			if (c.children.size) node.children = convert(c, ringIdx + 1)
			return node
		})
	}
	return { total: root.count, noFirstRingValue, rings: out, nodes: convert(root, 0) }
}

/** category handling of one ring's term. `refs` is getData's refs.byTermId entry of the tw */
export function getRing(tw: any, refs: any): Ring {
	const term = tw.term
	const values = term.values || {}
	const uncomputable = (k: any) => k !== undefined && values[k]?.uncomputable

	if (term.type == 'categorical') {
		const groupset = get_active_groupset(term, tw.q)
		if (groupset) {
			const groups: any[] = groupset.groups || []
			const byName = new Map(groups.map((g, i) => [g.name, { g, i }]))
			return {
				keyOf: v => {
					if (!v || v.key === undefined || v.key === null) return undefined
					const key = String(v.key)
					const e = byName.get(key)
					if (!e || e.g.uncomputable) return undefined
					return key
				},
				category: key => {
					const g = byName.get(key)!.g
					const c: SunburstCategory = { label: g.name }
					if (g.color) c.color = g.color
					if (g.type == 'filter') c.filter = g.filter as Filter
					else c.tvs = { values: (g.values || []).map(v => ({ key: v.key, label: v.label })) }
					return c
				},
				rank: key => byName.get(key)?.i
			}
		}
		const hasOrder = Object.values(values).some((v: any) => Number.isFinite(v?.order))
		return {
			keyOf: v => {
				if (!v || v.key === undefined || v.key === null || v.key === '') return undefined
				if (uncomputable(v.key)) return undefined
				return String(v.key)
			},
			category: key => {
				const label = values[key]?.label ?? key
				const c: SunburstCategory = { label, tvs: { values: [{ key, label }] } }
				if (values[key]?.color) c.color = values[key].color
				return c
			},
			rank: key => (hasOrder && Number.isFinite(values[key]?.order) ? values[key].order : undefined)
		}
	}

	// numeric, binned: the sample key is the bin label
	const bins: any[] = refs?.bins || []
	const binIdx = new Map(bins.map((b, i) => [b.label, i]))
	return {
		keyOf: v => {
			if (!v || v.key === undefined || v.key === null) return undefined
			if (uncomputable(v.key) || uncomputable(v.value)) return undefined
			const key = String(v.key)
			return binIdx.has(key) ? key : undefined
		},
		// no colour: getData gives every bin a palette colour, which is not the term's own, so bins take
		// shades of their parent's hue
		category: key => {
			const bin = { ...bins[binIdx.get(key)!] }
			delete bin.color
			return { label: bin.label ?? key, tvs: { ranges: [bin] } }
		},
		rank: key => binIdx.get(key)
	}
}
