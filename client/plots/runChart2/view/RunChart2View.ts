import type { RunChart2 } from '../RunChart2.ts'

export class RunChart2View {
	runChart2: RunChart2
	dom: {
		holder: any
		mainDiv: any
		loadingDiv: any
		errorDiv: any
		controlsHolder: any
	}

	constructor(runChart2: RunChart2) {
		this.runChart2 = runChart2
		this.initDom()
	}

	initDom() {
		const holder = this.runChart2.dom.holder || this.runChart2.opts.holder
		if (!holder) {
			throw new Error('RunChart2View: holder not available')
		}

		this.dom = {
			holder,
			mainDiv: holder.append('div').attr('class', 'sjpp-runchart2-main'),
			loadingDiv: holder
				.append('div')
				.attr('class', 'sjpp-runchart2-loading')
				.style('display', 'none')
				.text('Loading...'),
			errorDiv: holder
				.append('div')
				.attr('class', 'sjpp-runchart2-error')
				.style('display', 'none')
				.style('color', 'red'),
			controlsHolder: holder.append('div').attr('class', 'sjpp-runchart2-controls')
		}
	}

	async getControlInputs() {
		const inputs: any[] = [
			{
				type: 'term',
				configKey: 'term',
				chartType: 'runChart2',
				usecase: { target: 'runChart2', detail: 'numeric' },
				title: 'Date term for X axis',
				label: 'X (Date)',
				vocabApi: this.runChart2.app.vocabApi,
				menuOptions: '!remove',
				numericEditMenuVersion: ['continuous']
			},
			{
				type: 'term',
				configKey: 'term2',
				chartType: 'runChart2',
				usecase: { target: 'runChart2', detail: 'numeric' },
				title: 'Value term for Y axis',
				label: 'Y (Value)',
				vocabApi: this.runChart2.app.vocabApi,
				menuOptions: '!remove',
				numericEditMenuVersion: ['continuous']
			},
			{
				label: 'Aggregation',
				type: 'dropdown',
				chartType: 'runChart2',
				settingsKey: 'aggregation',
				title: 'How to aggregate values per time point',
				options: [
					{ label: 'Mean', value: 'mean' },
					{ label: 'Median', value: 'median' },
					{ label: 'Count', value: 'count' },
					{ label: 'Proportion', value: 'proportion' }
				]
			},
			{
				label: 'Chart width',
				type: 'number',
				chartType: 'runChart2',
				settingsKey: 'svgw',
				title: 'Width of the chart in pixels'
			},
			{
				label: 'Chart height',
				type: 'number',
				chartType: 'runChart2',
				settingsKey: 'svgh',
				title: 'Height of the chart in pixels'
			},
			{
				label: 'Default color',
				type: 'color',
				chartType: 'runChart2',
				settingsKey: 'defaultColor',
				title: 'Default color for the line and points'
			}
		]

		return inputs
	}
}
