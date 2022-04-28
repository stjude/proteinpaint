import { select, event } from 'd3-selection'
import { initByInput } from './controls.config'
import { to_svg } from '../../src/client'

export class MatrixControls {
	constructor(opts, appState) {
		this.type = 'matrixControls'
		this.opts = opts
		/* 
			for now, use the recoverInit at the global,
			may use subapp state/recovery later
		 */
		//this.recover = new Recover({app: opts.app})
		this.setButtons()
		this.setInputGroups()
	}

	setButtons() {
		this.opts.holder
			.style('margin', '10px 10px 20px 10px')
			.selectAll('button')
			.data([
				{ value: 'samples', label: 'Samples' },
				{ value: 'anno', label: 'Terms' },
				{ value: 'cols', label: 'Column layout' },
				{ value: 'rows', label: 'Row layout' },
				//{ label: 'Undo', callback: ()=>this.recover.goto(-1) },
				//{ label: 'Redo', callback: ()=>this.recover.goto(1) },
				{ label: 'Download SVG', callback: () => to_svg(this.opts.getSvg(), 'matrix', { apply_dom_styles: true }) }
			])
			.enter()
			.append('button')
			.style('margin', '2px 0')
			.text(d => d.label)
			.on('click', d => (d.callback ? d.callback() : this.callback(d)))
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
					label: 'Sort samples',
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'sortSamplesBy',
					options: [{ label: 'as-listed', value: 'asListed' }, { label: 'selected terms', value: 'selectedTerms' }]
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
					label: 'Terms as columns',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'matrix',
					settingsKey: 'transpose'
				},
				{
					label: 'Display sample counts for gene',
					boxLabel: '',
					type: 'checkbox',
					chartType: 'matrix',
					settingsKey: 'samplecount4gene'
				},
				{
					label: 'Sort terms',
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'sortTermsBy',
					options: [{ label: 'as-listed', value: 'asListed' }, { label: 'by sample count', value: 'sampleCount' }]
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
					label: 'Group gap',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'colgspace'
				},
				{
					label: 'Column label offset',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'collabelgap'
				},
				{
					label: 'Top labels',
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'collabelpos',
					options: [{ label: 'Columns', value: 'top' }, { label: 'Groups', value: 'bottom' }]
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
				},
				{
					label: 'Group gap',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'rowgspace'
				},
				{
					label: 'Left labels',
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'rowlabelpos',
					options: [{ label: 'Rows', value: 'left' }, { label: 'Groups', value: 'right' }]
				}
			]
		}
	}

	main() {
		//this.recover.track()
	}

	async callback(d) {
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

const defaultRecoverOpts = {
	maxHistoryLen: 5
}

class Recover {
	constructor(opts = {}) {
		this.type = 'recover'
		this.app = opts.app
		this.opts = Object.assign({}, defaultRecoverOpts, opts)
		this.currIndex = -1
		this.history = []
		// turn off during testing of other components for lighter memory usage
		this.isActive = !isNaN(this.opts.maxHistoryLen) && +this.opts.maxHistoryLen > 0
	}

	async track() {
		this.state = this.app.getState()
		if (this.isRecovering) {
			this.isRecovering = false
			return
		}
		this.isRecovering = false
		if (this.currIndex < this.history.length - 1) {
			this.history.splice(this.currIndex, this.history.length - (this.currIndex + 1))
		}
		this.history.push(this.state)
		this.currIndex += 1

		if (this.history.length > this.opts.maxHistoryLen) {
			this.history.shift()
			this.currIndex += -1
		}
	}

	goto(i) {
		console.log()
		if (i < 0 && this.currIndex + i > -1) this.currIndex += i
		else if (i > 0 && this.currIndex + i < this.history.length) this.currIndex += i
		else return
		this.isRecovering = true
		const state = this.history[this.currIndex]
		console.log(227, i, this.currIndex, state)
		this.app.dispatch({ type: 'app_refresh', state })
	}
}
