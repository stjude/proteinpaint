import { arc, pie } from 'd3-shape'
import { capitalizeFirstLetter } from '#dom'
import type { AggMatrixDot, AggMatrixPie, ValidAggMatrixResponse } from '#types'
import { GENE_VARIANT } from '#types'
import { mclass } from '#shared/common.js'
import type { AggregateMatrixSettings } from '../settings/Settings.ts'
import type {
	AggMatrixDotPosition,
	AggMatrixPiePosition,
	AggMatrixViewData,
	PieLegendEntry
} from './ViewModelDataTypes.ts'

/** View model logic of the pies of the aggregate matrix. Pure functions: the server decides which slices a pie
 * has and how large it is relative to the others, and this turns that into what the client draws. */

type PieSlice = AggMatrixPie['slices'][number]

/** True when the matrix is a pie chart, so any dot of it is a pie or is no data. */
export function hasPies(data: AggMatrixDot[][]): boolean {
	return data.some(row => row.some(dot => dot.pie))
}

/** What a dot adds to the view data when it has a pie.
 * - pie: what to draw. Not set when there is nothing to draw: the dot has no pie, or all of its slices are hidden.
 * - tipData: the number of samples and every slice, hidden ones too, for the tooltip.
 * - isNoData: the dot is treated as having no data. In a pie chart, a dot is a pie or it is no data, so it
 *   is blank and its tooltip reports that no data is available. */
export function getDotPie(
	dot: AggMatrixDot,
	settings: AggregateMatrixSettings,
	isPieChart: boolean,
	sampleType?: ValidAggMatrixResponse['sampleType']
) {
	const position = dot.pie ? getPiePosition(dot.pie, settings) : undefined
	const pie = position?.slices.length ? position : undefined
	return {
		pie,
		tipData: dot.pie && pie ? getPieTipData(dot.pie, settings, sampleType) : [],
		isNoData: isPieChart && !pie
	}
}

/** Whether a slice is not drawn. The server flags the slices that are hidden by default, such as wildtype, until
 * the user chooses which slices to hide in the legend. */
export function isSliceHidden(slice: PieSlice, settings: Pick<AggregateMatrixSettings, 'hiddenSliceKeys'>): boolean {
	return settings.hiddenSliceKeys ? settings.hiddenSliceKeys.includes(slice.key) : !!slice.hidden
}

/** The server sends default labels and colors for variant classes. The mclass of the client has the
 * mclassOverride of the launch arguments applied, so a variant class is described by it instead. */
export function describeSlice(slice: PieSlice, termType?: string) {
	if (termType == GENE_VARIANT && Object.prototype.hasOwnProperty.call(mclass, slice.key)) {
		const { label, color } = mclass[slice.key]
		return { label, color }
	}
	return { label: slice.label, color: slice.color }
}

/** Pie area is proportional to the number of samples. A pie is never smaller than the smallest dot.
 * Slices that are hidden, such as wildtype, are not drawn, so the pie shows the rest of the samples. */
export function getPiePosition(data: AggMatrixPie, settings: AggregateMatrixSettings): AggMatrixPiePosition {
	const radius = Math.max(settings.minDotSize, data.radius * settings.maxDotSize)
	const arcs = pie<PieSlice>()
		.sort(null)
		.value(slice => slice.count)(data.slices.filter(slice => !isSliceHidden(slice, settings)))
	const makePath = arc<any>().innerRadius(0).outerRadius(radius)
	return {
		radius,
		n: data.n,
		slices: arcs.map(a => ({
			key: a.data.key,
			count: a.data.count,
			...describeSlice(a.data, data.termType),
			path: makePath(a) || ''
		}))
	}
}

/** The tooltip reports only the slices that are drawn, so a slice that is hidden is not listed and is not in the total.
 * - gene variant: the samples with a variant, which does not follow the hidden slices, and the variants of the drawn slices
 * - other terms: the samples of the drawn slices */
export function getPieTipData(
	data: AggMatrixPie,
	settings: Pick<AggregateMatrixSettings, 'hiddenSliceKeys'>,
	sampleType?: ValidAggMatrixResponse['sampleType']
) {
	const drawn = data.slices.filter(slice => !isSliceHidden(slice, settings))
	const total = drawn.reduce((sum, slice) => sum + slice.count, 0)
	const samples = capitalizeFirstLetter(sampleType?.plural_name || 'samples')
	const entries: AggMatrixDotPosition['tipData'] = []
	if (data.termType == GENE_VARIANT && data.variantSamples !== undefined) {
		entries.push({ label: `${samples} with a variant`, value: data.variantSamples })
		entries.push({ label: 'Variants', value: total })
	} else {
		entries.push({ label: samples, value: total })
	}
	for (const slice of drawn) {
		entries.push({ label: describeSlice(slice, data.termType).label, value: slice.count })
	}
	return entries
}

/** One entry for every slice that can be drawn, hidden or not, in order of first appearance.
 * Slices that are not computable are never sent by the server, so they are not here. */
export function getPieLegend(
	data: AggMatrixDot[][],
	settings: Pick<AggregateMatrixSettings, 'hiddenSliceKeys'> = {}
): AggMatrixViewData['pieLegend'] {
	const entries = new Map<string, PieLegendEntry>()
	let termType: string | undefined
	for (const row of data) {
		for (const dot of row) {
			if (!dot.pie) continue
			termType ??= dot.pie.termType
			for (const slice of dot.pie.slices) {
				if (!entries.has(slice.key)) {
					entries.set(slice.key, {
						key: slice.key,
						...describeSlice(slice, dot.pie.termType),
						hidden: isSliceHidden(slice, settings)
					})
				}
			}
		}
	}
	return { title: termType == GENE_VARIANT ? 'Variant class' : 'Category', entries: [...entries.values()] }
}
