import type { Filter, SunburstResponse, SunburstNode, SunburstCategory } from '#types'
import type { SunNode } from './SunburstRenderer'

/*
Data helpers of the term-based sunburst, without any DOM code: the termdb/sunburst response as a renderer 
tree, and selected wedges as a group filter. Kept apart from sunburst.ts so they can be unit-tested directly.
*/

/** a wedge of the term sunburst. `id` names it by its path of [ring $id, key] pairs, as JSON so that no
 *  category key can make two paths alike, and a selection can survive a re-fetch; `ring`, `key` and
 *  `category` say which ring category it is */
export type TermSunNode = SunNode & {
	id: string
	ring: number
	key: string
	category: SunburstCategory
	/** samples under the wedge (SunNode.value is only those that end here) */
	count: number
	children?: TermSunNode[]
}

type TermSunRoot = SunNode & { children: TermSunNode[]; count: number }

/** the response as a renderer tree; first-ring colours from the dataset (keyed by category key) win
 *  over the term's own */
export function buildTermTree(
	res: SunburstResponse,
	twLst: any[],
	rootName: string,
	colors?: { [key: string]: string }
): TermSunRoot {
	const convert = (n: SunburstNode, ring: number, parentPath: string[][]): TermSunNode => {
		const tw = twLst[ring]
		const category = res.rings[ring].categories[n.key] || { label: n.key }
		const path = [...parentPath, [tw.$id, n.key]]
		const children = (n.children || []).map(c => convert(c, ring + 1, path))
		const node: TermSunNode = {
			name: category.label,
			level: tw.term.name,
			// d3 adds the children to a node's own value, so it holds only the samples that end here
			value: n.count - children.reduce((s, c) => s + c.count, 0),
			count: n.count,
			id: JSON.stringify(path),
			ring,
			key: n.key,
			category
		}
		const color = (ring == 0 && colors?.[n.key]) || category.color
		if (color) node.color = color
		if (children.length) node.children = children
		return node
	}
	return { name: rootName, value: 0, count: res.total, children: res.nodes.map(n => convert(n, 0, [])) }
}

/** one ring category as a filter entry: the tvs of the ring's term, or a filter group's own filter */
export function categoryFilterItem(tw: any, category: SunburstCategory): any {
	if (category.filter) return structuredClone(category.filter)
	if (!category.tvs) throw `no filter for category '${category.label}' of ${tw.term.name}`
	return { type: 'tvs', tvs: { term: tw.term, ...structuredClone(category.tvs) } }
}

/** the samples of one wedge: its categories along the path from the first ring, joined by "and" */
export function wedgeFilter(path: TermSunNode[], twLst: any[]): Filter {
	const lst = path.map(n => categoryFilterItem(twLst[n.ring], n.category))
	return { type: 'tvslst', in: true, join: lst.length > 1 ? 'and' : '', lst }
}

/** the samples of any of the selected wedges, each given as its path from the first ring. One wedge
 *  is just its own filter; several are joined by "or" */
export function selectionFilter(paths: TermSunNode[][], twLst: any[]): Filter {
	if (!paths.length) throw 'no wedge selected'
	if (paths.length == 1) return wedgeFilter(paths[0], twLst)
	return { type: 'tvslst', in: true, join: 'or', lst: paths.map(p => wedgeFilter(p, twLst)) }
}

/** a readable name for a selection: the path of one wedge (e.g. "BCP-ALL › Hyperdiploid"), or the
 *  wedge names joined when several are selected */
export function selectionName(paths: TermSunNode[][], maxLen = 60): string {
	const names =
		paths.length == 1 ? paths[0].map(n => n.name).join(' › ') : paths.map(p => p[p.length - 1].name).join(' or ')
	return names.length > maxLen ? names.slice(0, maxLen - 1) + '…' : names
}

/** the sample types a new or replacing ring may have, given the other rings: the line of descent through
 *  the deepest of their sample types (its ancestors, itself and its descendants), since no value maps
 *  between sibling types such as primary and PDX samples. Undefined (any type) when the dataset has one
 *  sample type or no other ring is below the top level. `sampleTypes` is termdbConfig.sampleTypes */
export function allowedSampleTypes(otherTwLst: any[], sampleTypes?: { [id: string]: any }): number[] | undefined {
	if (!sampleTypes || Object.keys(sampleTypes).length < 2) return
	const parent = (t: string) => {
		const p = sampleTypes[t]?.parent_id
		return p === null || p === undefined ? undefined : String(p)
	}
	const ancestors = (t: string) => {
		const lst: string[] = []
		for (let p = parent(t); p !== undefined && !lst.includes(p); p = parent(p)) lst.push(p)
		return lst
	}
	const types = otherTwLst
		.map(tw => tw.term?.sample_type)
		.filter(t => t !== null && t !== undefined && sampleTypes[t])
		.map(String)
	const below = types.filter(t => parent(t) !== undefined)
	if (!below.length) return
	const deepest = below.reduce((a, b) => (ancestors(b).length > ancestors(a).length ? b : a))
	const descendants = Object.keys(sampleTypes).filter(t => ancestors(t).includes(deepest))
	return [...ancestors(deepest), deepest, ...descendants].map(Number)
}
