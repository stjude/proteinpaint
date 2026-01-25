import { term0_term2_defaultQ } from '../controls'
import type { AppApi } from '#rx'

export function getRunChart2Controls(app: AppApi) {
	const inputs: { [index: string]: any }[] = [
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

	return inputs
}
