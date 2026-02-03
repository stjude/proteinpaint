import { term0_term2_defaultQ } from '../controls'
import type { AppApi } from '#rx'
import { roundValueAuto } from '#shared/roundValue.js'
import { fillTermWrapper } from '#termsetting'
import { isNumericTerm } from '#shared/terms.js'

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
			configKey: 'term',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'term' },
			label: 'X',
			vocabApi: app.vocabApi,
			menuOptions: 'edit',
			numericEditMenuVersion: ['continuous', 'discrete']
		},
		{
			type: 'term',
			configKey: 'term2',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'term2' },
			label: 'Y',
			vocabApi: app.vocabApi,
			defaultQ4fillTW: term0_term2_defaultQ,
			numericEditMenuVersion: ['continuous', 'discrete']
		},
		{
			label: 'Aggregation',
			type: 'dropdown',
			chartType: 'runChart2',
			settingsKey: 'aggregation',
			options: [
				{ label: 'Mean', value: 'mean' },
				{ label: 'Median', value: 'median' },
				{ label: 'Count', value: 'count' }
			]
		},
		{
			type: 'term',
			configKey: 'divideBy',
			chartType: 'runChart2',
			usecase: { target: 'runChart2', detail: 'divideBy' },
			title: 'Term to divide by categories',
			label: 'Divide by',
			vocabApi: app.vocabApi,
			numericEditMenuVersion: ['discrete'],
			processInput: async (tw: any) => {
				if (tw?.term && isNumericTerm(tw.term)) {
					tw.q = { ...tw.q, mode: 'discrete' }
					await fillTermWrapper(tw, app.vocabApi)
				}
				return tw
			},
			getDisplayStyle: (plot: any) => (plot?.config?.term?.q?.mode === 'discrete' ? 'table-row' : 'none')
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
	runChart2?: { dom: { controls: any } }
) {
	const inputs: any[] = getBaseInputs(app)
	if (range) {
		inputs.push(...getMinMaxInputs(range, runChart2))
	}
	return inputs
}
