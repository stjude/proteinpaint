import { select, event } from 'd3-selection'
import { initByInput } from './controls.config'

export class MatrixControls {
	constructor(opts, appState) {
		this.type = 'matrixControls'
		this.opts = opts
		this.setButtons()
		this.setInputGroups()
	}

	setButtons() {
		this.opts.holder
			.style('margin', '10px 10px 20px 10px')
			.selectAll('button')
			.data([
				{ value: 'samples', label: 'Samples' },
				{ value: 'anno', label: 'Annotations' },
				{ value: 'cols', label: 'Column dimensions' },
				{ value: 'rows', label: 'Row dimensions' }
			])
			.enter()
			.append('button')
			.style('margin', '2px 0')
			.text(d => d.label)
			.on('click', d => this.main(d))
	}

	setInputGroups() {
		this.inputGroups = {
			samples: [
				{
					label: 'Sample as rows',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'matrix',
					settingsKey: 'transpose'
				},
				{
					label: 'Group samples by',
					type: 'term',
					chartType: 'matrix',
					configKey: 'divideBy',
					vocabApi: this.opts.app.vocabApi,
					state: {
						vocab: this.opts.vocab
						//activeCohort: appState.activeCohort
					}
				}
			],

			anno: [
				{
					label: 'Annotations as columns',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'matrix',
					settingsKey: 'transpose'
				}
			],

			cols: [
				{
					label: 'Column width',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'colw'
				},
				{
					label: 'Column gap',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'colspace'
				},
				{
					label: 'Column label offset',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'collabelgap'
				}
			],

			rows: [
				{
					label: 'Row height',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'rowh'
				},
				{
					label: 'Row gap',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'rowspace'
				},
				{
					label: 'Row label offset',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'rowlabelgap'
				}
			]
		}
	}

	async main(d) {
		const { clientX, clientY } = event
		const app = this.opts.app
		const parent = this.opts.parent
		const table = app.tip.clear().d.append('table')

		for (const inputConfig of this.inputGroups[d.value]) {
			const input = initByInput[inputConfig.type](
				Object.assign(
					{},
					{
						holder: table.append('tr'),
						dispatch: app.dispatch,
						id: parent.id,
						//instanceNum: this.instanceNum,
						debug: this.opts.debug,
						parent
					},
					inputConfig
				)
			)

			input.main(parent.config)
		}

		app.tip.showunder(event.target)
	}
}
