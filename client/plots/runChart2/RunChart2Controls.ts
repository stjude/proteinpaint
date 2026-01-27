import { term0_term2_defaultQ } from '../controls'
import type { AppApi } from '#rx'
import { roundValueAuto } from '#shared/roundValue.js'

/** Returns X and Y axis min/max inputs from data range (matches scatter getMinMaxInputs). */
export function getMinMaxInputs(range: { xMin: number; xMax: number; yMin: number; yMax: number }) {
	const fallback = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
	const r =
		[range.xMin, range.xMax, range.yMin, range.yMax].every(n => Number.isFinite(n)) &&
		range.xMin < range.xMax &&
		range.yMin < range.yMax
			? range
			: fallback
	const xMin = roundValueAuto(r.xMin)
	const xMax = roundValueAuto(r.xMax)
	const xStep = (xMax - xMin) / 10 || 0.1
	const yMin = roundValueAuto(r.yMin)
	const yMax = roundValueAuto(r.yMax)
	const yStep = (yMax - yMin) / 10 || 0.1

	return [
		{
			label: 'X axis minimum',
			type: 'number',
			chartType: 'runChart2',
			settingsKey: 'minXScale',
			title: `Set the minimum X axis value between ${xMin} and ${xMax}`,
			placeholder: `${xMin}`,
			min: xMin,
			max: xMax,
			step: xStep,
			allowNull: true
		},
		{
			label: 'X axis maximum',
			type: 'number',
			chartType: 'runChart2',
			settingsKey: 'maxXScale',
			title: `Set the maximum X axis value between ${xMin} and ${xMax}`,
			placeholder: `${xMax}`,
			min: xMin,
			max: xMax,
			step: xStep,
			allowNull: true
		},
		{
			label: 'Y axis minimum',
			type: 'number',
			chartType: 'runChart2',
			settingsKey: 'minYScale',
			title: `Set the minimum Y axis value between ${yMin} and ${yMax}`,
			placeholder: `${yMin}`,
			min: yMin,
			max: yMax,
			step: yStep,
			allowNull: true
		},
		{
			label: 'Y axis maximum',
			type: 'number',
			chartType: 'runChart2',
			settingsKey: 'maxYScale',
			title: `Set the maximum Y axis value between ${yMin} and ${yMax}`,
			placeholder: `${yMax}`,
			min: yMin,
			max: yMax,
			step: yStep,
			allowNull: true
		}
	]
}

function getBaseInputs(app: AppApi) {
	return [
		{
			type: 'term',
			configKey: 'term',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'term' },
			label: 'X',
			vocabApi: app.vocabApi,
			menuOptions: 'edit'
		},
		{
			type: 'term',
			configKey: 'term2',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'term2' },
			label: 'Y',
			vocabApi: app.vocabApi,
			defaultQ4fillTW: term0_term2_defaultQ
		},
		{
			label: 'Plot height',
			title: 'Set the plot height in pixels, >=200',
			type: 'number',
			chartType: 'runChart2',
			settingsKey: 'svgh',
			debounceInterval: 500,
			min: 200,
			step: 25
		},
		{
			label: 'Plot width',
			title: 'Set the plot width in pixels, >=200',
			type: 'number',
			chartType: 'runChart2',
			settingsKey: 'svgw',
			debounceInterval: 500,
			min: 200,
			step: 25
		},
		{
			label: 'Default color',
			type: 'color',
			chartType: 'runChart2',
			settingsKey: 'color'
		}
	]
}

/** @param range - data range { xMin, xMax, yMin, yMax }; when provided, appends getMinMaxInputs. */
export function getRunChart2Controls(app: AppApi, range?: { xMin: number; xMax: number; yMin: number; yMax: number }) {
	const inputs: any[] = getBaseInputs(app)
	if (range) {
		inputs.push(...getMinMaxInputs(range))
	}
	return inputs
}
