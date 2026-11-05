import type { AggregateMatrixSettings } from './Settings.ts'
import { getAxisTermTypes } from '#shared/aggregateMatrix.js'

const dotSizeDefaults = {
	minDotSize: 5,
	maxDotSize: 20,
	dotInputMin: 2,
	dotInputMax: 35
}
/** Pies need more room than dots, so a pie chart defaults to larger sizes. */
const pieSizeDefaults = {
	minDotSize: 30,
	maxDotSize: 60,
	dotInputMin: dotSizeDefaults.minDotSize,
	dotInputMax: 300
}
/** The length of a row or column as a multiple of the largest dot: the dot and room around it */
export const cellToDotSize = 2.5
/** What the labels, axis titles, and legend take of the width and the height, so the cells cannot use it.
 * An estimate: the labels depend on the data, and the plot may not fill the window. */
const reservedSpace = { width: 400, height: 250 }

/** The default sizes of a pie chart, scaled down so that every row and column fits in the window. This is an estimate
 * of the room the plot has. The count is of the terms of the request, as the categories that a term expands into are
 * not known yet. Sizes are never above the pie defaults or below the dot defaults, and a min or max set by the user
 * is left alone. The viewport is the room that the plot is estimated to have. */
export function getPieSizeDefaults(
	rows: any,
	columns: any,
	overrides: Partial<AggregateMatrixSettings> = {},
	viewport = { width: window.innerWidth, height: window.innerHeight }
) {
	if (overrides.minDotSize !== undefined || overrides.maxDotSize !== undefined) return pieSizeDefaults
	const cellSize = Math.min(
		(viewport.width - reservedSpace.width) / getAxisTermTypes(columns).length,
		(viewport.height - reservedSpace.height) / getAxisTermTypes(rows).length
	)
	const maxDotSize = Math.min(
		pieSizeDefaults.maxDotSize,
		Math.max(dotSizeDefaults.maxDotSize, Math.floor(cellSize / cellToDotSize))
	)
	// the min size keeps its ratio to the max size
	const minDotSize = Math.round((pieSizeDefaults.minDotSize * maxDotSize) / pieSizeDefaults.maxDotSize)
	return { ...pieSizeDefaults, minDotSize, maxDotSize }
}

export function getAggregateMatrixSettings(overrides = {}, sizeDefaults = {}): AggregateMatrixSettings {
	const defaults = {
		startColor: '#ff9400',
		stopColor: '#0080ff',
		gradientMethod: 'mean',
		sizeMethod: 'percent',
		...dotSizeDefaults,
		...sizeDefaults
	}

	const mergedSettings = Object.assign({}, defaults, overrides)
	const isValidMinMax = validateMinMaxDotSetting(mergedSettings, mergedSettings.minDotSize, mergedSettings.maxDotSize)
	if (isValidMinMax !== null) {
		throw new Error(`Invalid min/max dot size settings: ${isValidMinMax}`)
	}

	return mergedSettings
}

export function validateMinMaxDotSetting(settings: AggregateMatrixSettings, min, max): string | null {
	if (min < settings.dotInputMin) {
		return `Minimum dot size must be greater than or equal to ${settings.dotInputMin}`
	}
	if (max > settings.dotInputMax) {
		return `Maximum dot size must be less than or equal to ${settings.dotInputMax}`
	}
	if (min > max) {
		return `Minimum dot size must be less than or equal to maximum dot size`
	}
	return null
}
