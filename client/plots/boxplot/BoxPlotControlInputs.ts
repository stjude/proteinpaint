import { term0_term2_defaultQ, renderTerm1Label } from '../controls'

export function setBoxPlotControlInputs(state: any, app: any, opts: any, charts: any, useDefaultSettings: boolean) {
	const controlLabels = state.config.controlLabels
	if (!controlLabels) throw new Error('controls labels not found')

	const inputs: { [index: string]: any }[] = [
		{
			type: 'term',
			configKey: 'term',
			chartType: 'boxplot',
			usecase: { target: 'boxplot', detail: 'term' },
			label: controlLabels.term1?.label || renderTerm1Label,
			vocabApi: app.vocabApi,
			menuOptions: 'edit'
		},
		{
			type: 'term',
			configKey: 'term2',
			chartType: 'boxplot',
			usecase: { target: 'boxplot', detail: 'term2' },
			title: controlLabels.term2.title || controlLabels.term2.label,
			label: controlLabels.term2.label,
			vocabApi: app.vocabApi,
			numericEditMenuVersion: opts.numericEditMenuVersion || ['continuous', 'discrete'],
			defaultQ4fillTW: term0_term2_defaultQ
		},
		{
			type: 'term',
			configKey: 'term0',
			chartType: 'boxplot',
			usecase: { target: 'boxplot', detail: 'term0' },
			title: controlLabels.term0.title || controlLabels.term0.label,
			label: controlLabels.term0.label,
			vocabApi: app.vocabApi,
			numericEditMenuVersion: opts.numericEditMenuVersion || ['continuous', 'discrete'],
			defaultQ4fillTW: term0_term2_defaultQ
		},
		{
			label: 'Order by',
			title: 'Order box plots by parameters',
			type: 'radio',
			chartType: 'boxplot',
			settingsKey: 'orderByMedian',
			options: [
				{ label: 'Default', value: false },
				{ label: 'Median values', value: true }
			],
			getDisplayStyle: () => {
				let style = 'none'
				for (const k of Object.keys(charts)) {
					const chart = charts[k]
					if (chart.plots.length > 1) style = ''
				}
				return style
			}
		},
		{
			label: 'Scale',
			title: 'Change the axis scale',
			type: 'radio',
			chartType: 'boxplot',
			settingsKey: 'isLogScale',
			options: [
				{ label: 'Linear', value: false },
				{ label: 'Log10', value: true }
			]
		},
		{
			label: 'Orientation',
			title: 'Change the orientation of the box plots',
			type: 'radio',
			chartType: 'boxplot',
			settingsKey: 'isVertical',
			options: [
				{ label: 'Vertical', value: true },
				{ label: 'Horizontal', value: false }
			]
		},
		{
			label: 'Plot length',
			title: 'Set the plot length of the entire plot in pixels, >=200',
			type: 'number',
			chartType: 'boxplot',
			settingsKey: 'plotLength',
			debounceInterval: 500,
			min: 200,
			step: 10
		},
		{
			label: 'Plot height',
			title: 'Set the height of each box plot between 20 and 50',
			type: 'number',
			chartType: 'boxplot',
			settingsKey: 'rowHeight',
			step: 1,
			max: 50,
			min: 20,
			debounceInterval: 500,
			processInput: (val: number) => {
				/**TODO: This is a hack. */
				if (useDefaultSettings == true) useDefaultSettings = false
				return val
			}
		},
		{
			label: 'Plot padding',
			title: 'Set the space between each box plot. Number must be between 10 and 20',
			type: 'number',
			chartType: 'boxplot',
			settingsKey: 'rowSpace',
			step: 1,
			max: 20,
			min: 10,
			debounceInterval: 500,
			processInput: (val: number) => {
				/**TODO: This is a hack. */
				if (useDefaultSettings == true) useDefaultSettings = false
				return val
			}
		},
		{
			label: 'Default color',
			type: 'color',
			chartType: 'boxplot',
			settingsKey: 'color',
			getDisplayStyle: () => {
				console.log(Object.keys(charts))
				let style = ''
				for (const k of Object.keys(charts)) {
					const chart = charts[k]
					if (chart.plots.length > 1) style = 'none'
				}
				return style
			}
		},
		{
			label: 'Display mode',
			title: 'Apply a dark theme to the plot',
			type: 'radio',
			chartType: 'boxplot',
			settingsKey: 'displayMode',
			options: [
				{ label: 'Default', value: 'default' },
				{ label: 'Filled', value: 'filled' },
				{ label: 'Dark mode', value: 'dark' }
			]
		},
		{
			label: 'Show association tests',
			boxLabel: '',
			type: 'checkbox',
			chartType: 'boxplot',
			settingsKey: 'showAssocTests',
			title: `Show association tests next to the box plots.`,
			getDisplayStyle: plot => {
				return plot?.term2 ? '' : 'none'
			}
		}
	]

	if (state.termdbConfig?.boxplots?.removeOutliers) {
		inputs.push({
			label: 'Remove outliers',
			boxLabel: '',
			type: 'checkbox',
			chartType: 'boxplot',
			settingsKey: 'removeOutliers',
			title: `Option to remove outliers from the analysis`
		})
	}

	return inputs
}
