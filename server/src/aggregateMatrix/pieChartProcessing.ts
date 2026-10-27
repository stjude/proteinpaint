import type { AggMatrixPie } from '#types'
import { GENE_VARIANT } from '#types'
import { getColors } from '#shared/common.js'

/** The most slices one pie may have. The smallest classes beyond this are folded into one "other" slice. */
export const MAX_SLICES = 40
export const OTHER_KEY = '__other__'
const OTHER_LABEL = 'Other'
const OTHER_COLOR = '#bdbdbd'
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export type SliceDef = { key: string; label: string; color: string }

/** Decides which slices a term's annotation falls into, and how each slice looks.
 * The server is the only place that decides labels and colors, so the client needs nothing but the response. */
export interface SliceScheme {
	/** Term type of the slices, so the client knows what the keys mean. Absent when not known. */
	termType?: string
	/** The slice key of each value of an annotation. A sample with several values contributes every one of them. */
	keysOf(annotation: any): string[]
	/** Ordered definitions of the observed keys. Called once per chart, after every key is known, so a
	 * color assigned here is the same in every pie and in the shared legend. */
	define(observed: Set<string>): SliceDef[]
}

type MclassLookup = Record<string, { key: string; label: string; color: string }>

/** Slices of a geneVariant term. Wildtype comes first, then the other classes in the order they are declared
 * in mclass. Not tested (Blank) is a regular class: datasets may use it for custom data.
 * Classes that are not in mclass are ignored, so labels and colors never come from the data. */
export function mclassScheme(mclass: MclassLookup): SliceScheme {
	const keys = Object.keys(mclass)
	const order = ['WT', ...keys.filter(k => k != 'WT')].filter(k => Object.hasOwn(mclass, k))
	const known = new Set(order)
	return {
		termType: GENE_VARIANT,
		keysOf(annotation) {
			if (!Array.isArray(annotation?.values)) return []
			const found: string[] = []
			for (const value of annotation.values) {
				const key = value?.class
				if (typeof key == 'string' && known.has(key)) found.push(key)
			}
			return found
		},
		define(observed) {
			return order.filter(k => observed.has(k)).map(k => ({ key: k, label: mclass[k].label, color: mclass[k].color }))
		}
	}
}

/** Slices of any term whose values are categories or bins. A color comes from the term when it has a
 * valid one for that key, and otherwise from the shared color scheme, assigned in key order. */
export function termValuesScheme(args: {
	keysOf: (annotation: any) => string[]
	/** Preferred slice order, such as the term's value or bin order. Observed keys not listed follow, in the order seen. */
	keyOrder: string[]
	labelOf: (key: string) => string
	colorOf: (key: string) => string | undefined
}): SliceScheme {
	return {
		keysOf: args.keysOf,
		define(observed) {
			const listed = new Set(args.keyOrder)
			const ordered = [...args.keyOrder.filter(k => observed.has(k)), ...[...observed].filter(k => !listed.has(k))]
			const fallback = getColors(ordered.length)
			return ordered.map(key => {
				const color = args.colorOf(key)
				const fallbackColor = fallback(key) as string
				return {
					key,
					label: args.labelOf(key),
					color: typeof color == 'string' && HEX_COLOR.test(color) ? color : fallbackColor
				}
			})
		}
	}
}

type Cell = { scheme: SliceScheme; n: number; counts: Map<string, number> }

/** Accumulates, per matrix cell, the slices of the samples in that cell.
 * Pure data in, data out: no dataset or database is needed to use it.
 * Keyed with Maps because cell indexes and keys are not trusted names. */
export class PieCounter {
	private readonly cells = new Map<number, Cell>()

	/** Count one sample in a cell. A sample with no usable value is not counted, so the cell
	 * stays empty when none of its samples have a value. */
	add(cellIndex: number, annotation: any, scheme: SliceScheme) {
		const keys = scheme.keysOf(annotation)
		if (!keys.length) return
		let cell = this.cells.get(cellIndex)
		if (!cell) {
			cell = { scheme, n: 0, counts: new Map() }
			this.cells.set(cellIndex, cell)
		}
		cell.n++
		for (const key of keys) cell.counts.set(key, (cell.counts.get(key) ?? 0) + 1)
	}

	/** One pie per cell with samples. Radius is relative (0 to 1) to the largest pie, scaled by the
	 * square root so that area is proportional to the number of samples. The client turns it into pixels.
	 * Slices with no count are omitted; the rest keep one fixed order. */
	build(): Map<number, AggMatrixPie> {
		let maxN = 0
		const observed = new Map<SliceScheme, Map<string, number>>()
		for (const { scheme, n, counts } of this.cells.values()) {
			if (n > maxN) maxN = n
			const totals = observed.get(scheme) ?? new Map<string, number>()
			for (const [key, count] of counts) totals.set(key, (totals.get(key) ?? 0) + count)
			observed.set(scheme, totals)
		}

		const defsByScheme = new Map<SliceScheme, { defs: SliceDef[]; folded: Set<string> }>()
		for (const [scheme, totals] of observed) {
			const defs = scheme.define(new Set(totals.keys()))
			const folded = new Set<string>()
			if (defs.length > MAX_SLICES) {
				const smallest = [...defs].sort((a, b) => (totals.get(a.key) ?? 0) - (totals.get(b.key) ?? 0))
				for (const def of smallest.slice(0, defs.length - (MAX_SLICES - 1))) folded.add(def.key)
			}
			defsByScheme.set(scheme, { defs, folded })
		}

		const pies = new Map<number, AggMatrixPie>()
		for (const [index, { scheme, n, counts }] of this.cells) {
			const { defs, folded } = defsByScheme.get(scheme)!
			const slices: AggMatrixPie['slices'] = []
			let other = 0
			for (const def of defs) {
				const count = counts.get(def.key)
				if (!count || !Number.isFinite(count)) continue
				if (folded.has(def.key)) other += count
				else slices.push({ key: def.key, label: def.label, color: def.color, count })
			}
			if (other) slices.push({ key: OTHER_KEY, label: OTHER_LABEL, color: OTHER_COLOR, count: other })
			const radius = maxN > 0 ? Math.sqrt(n / maxN) : 0
			pies.set(index, { n, radius, slices, ...(scheme.termType && { termType: scheme.termType }) })
		}
		return pies
	}
}
