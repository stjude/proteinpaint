import { term0_term2_defaultQ } from '../controls'
import type { AppApi } from '#rx'
import { roundValueAuto } from '#shared/roundValue.js'

/** Builds X/Y min-max control inputs from data range. Uses fallback 0–1 when range is invalid. */
export function getMinMaxInputs(
	range: { xMin: number; xMax: number; yMin: number; yMax: number },
	runChart2?: { dom: { controls: any } }
) {
	const fallback = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
	const valid =
		[range.xMin, range.xMax, range.yMin, range.yMax].every(n => Number.isFinite(n)) &&
		range.xMin < range.xMax &&
		range.yMin < range.yMax
	const r = valid ? range : fallback
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
			step: xStep
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
			...(runChart2 && {
				processInput: (value: number) => {
					/** When the user deletes a value, setNumberInput() in controls.config.js sets it to input.min. Instead, reset to default to allow the user to delete the value. */
					const sel = runChart2.dom.controls.selectAll('input').filter(function (this: HTMLInputElement) {
						return this.placeholder === `${xMax}`
					})
					if (!sel.node()?.value) return xMax
					return value
				}
			})
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
			step: yStep
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
			...(runChart2 && {
				processInput: (value: number) => {
					/** When the user deletes a value, setNumberInput() in controls.config.js sets it to input.min. Instead, reset to default to allow the user to delete the value. */
					const sel = runChart2.dom.controls.selectAll('input').filter(function (this: HTMLInputElement) {
						return this.placeholder === `${yMax}`
					})
					if (!sel.node()?.value) return yMax
					return value
				}
			})
		}
	]
}

function getBaseInputs(app: AppApi) {
	return [
		{
			type: 'term',
			configKey: 'xtw',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'numeric' },
			label: 'X',
			vocabApi: app.vocabApi,
			menuOptions: 'edit',
			numericEditMenuVersion: ['continuous', 'discrete']
		},
		{
			type: 'term',
			configKey: 'ytw',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'numeric' },
			label: 'Y',
			vocabApi: app.vocabApi,
			menuOptions: '{replace,remove}',
			defaultQ4fillTW: term0_term2_defaultQ,
			numericEditMenuVersion: ['continuous']
		},
		{
			label: 'Aggregation',
			type: 'dropdown',
			chartType: 'runChart2',
			settingsKey: 'aggregation',
			options: [{ label: 'Median', value: 'median' }]
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

export function getRunChart2Controls(
	app: AppApi,
	range?: { xMin: number; xMax: number; yMin: number; yMax: number },
	runChart2?: { dom: { controls: any }; state?: { config?: any } }
) {
	let inputs: any[] = getBaseInputs(app)
	const isFrequency = runChart2?.state?.config?.ytw == null
	if (isFrequency) {
		inputs = inputs.filter(i => i.settingsKey !== 'aggregation')
		const plotHeightIndex = inputs.findIndex(i => i.settingsKey === 'svgh')
		const cumulativeCheckbox = {
			label: 'Show cumulative frequency',
			boxLabel: '',
			type: 'checkbox',
			chartType: 'runChart2',
			settingsKey: 'showCumulativeFrequency',
			title: 'Show the cumulative number of events over time'
		}
		inputs.splice(plotHeightIndex >= 0 ? plotHeightIndex : inputs.length, 0, cumulativeCheckbox)
	}
	if (range) {
		inputs.push(...getMinMaxInputs(range, runChart2))
	}
	return inputs
}
