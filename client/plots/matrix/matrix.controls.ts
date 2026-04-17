import { initByInput } from '#plots/controls.config.js'
import { select } from 'd3-selection'
import { TermTypes } from '#shared/terms.js'
import { setSamplesBtn } from './matrix.controls.samples'
import { setGenesBtn } from './matrix.controls.genes'
import { setVariablesBtn } from './matrix.controls.variables'
import { setDimensionsBtn } from './matrix.controls.dimensions'
import { setLegendBtn } from './matrix.controls.legend'
import { setMutationBtn } from './matrix.controls.mutations'
import { setCNVBtn } from './matrix.controls.cnv'
import { setDownloadBtn } from './matrix.controls.download'
import { setZoomInput, setDragToggle, setSvgScroll } from './matrix.zoomPanScroll'

export class MatrixControls {
	type: string
	opts: any
	parent: any
	overrides: any
	zoomApi: any
	svgScrollApi: any
	dragToggleApi: any
	keyEventTarget: any
	btns: any
	activeTab: 'basic' | 'advanced' = 'basic'
	sorterUi!: any

	constructor(opts: any, appState: any) {
		this.type = 'matrixControls'
		this.opts = opts
		this.parent = opts.parent
		this.overrides = {}

		this.opts.holder.style('margin', '10px 10px 20px 10px').style('white-space', 'nowrap')
		const state = this.parent.getState(appState)
		const s = state.config.settings.matrix
		if (this.parent.setClusteringBtn)
			this.parent.setClusteringBtn(this.opts.holder, (event: any, data: any) => this.callback(event, data))
		setSamplesBtn(this, s)
		if (
			state.termdbConfig?.allowedTermTypes?.includes(TermTypes.GENE_VARIANT) ||
			state.termdbConfig.queries.snvindel ||
			(this.parent.chartType == 'hierCluster' && this.parent.config.dataType == TermTypes.GENE_EXPRESSION)
		) {
			setGenesBtn(this, s)
		}
		if (s.addMutationCNVButtons && this.parent.chartType !== 'hierCluster') {
			setMutationBtn(this)
			setCNVBtn(this)
		}
		setVariablesBtn(this, s)
		setDimensionsBtn(this, s)
		setLegendBtn(this)
		setDownloadBtn(this)
		setZoomInput(this)
		setDragToggle(this, {
			holder: this.opts.holder.append('div').style('display', 'inline-block'),
			target: this.parent.dom.seriesesG
		})
		setSvgScroll(this, state)

		this.keyboardNavHandler = async (event: any) => {
			if (event.target.tagName == 'BUTTON') this.keyEventTarget = event.target
			if (event.key == 'Escape') {
				this.parent.app.tip.hide()
			} else if (event.key == 'Enter' || event.key == 'ArrowDown') {
				const elems =
					event.target.tagName == 'BUTTON'
						? this.parent.app.tip.d.node().querySelectorAll('input, select')
						: event.target.querySelectorAll('input, select')
				for (const elem of elems) {
					if (elem.checkVisibility?.() || (!elem.checkVisibility && elem.getBoundingClientRect().height)) {
						elem.focus()
						return false
					}
				}
			} else if ((event.key == 'Tab' && event.shiftKey) || event.key == 'Backspace' || event.key == 'ArrowUp') {
				this.keyEventTarget.focus()
				return false
			} //else if (event.keyShift && el)
		}

		this.btns = this.opts.holder
			.selectAll(':scope>button')
			.filter((d: any) => d && d.label)
			.on(`keyup.matrix-${this.parent.id}`, this.keyboardNavHandler)
	}

	keyboardNavHandler: any

	main(overrides: any = {}) {
		this.overrides = overrides
		this.parent.app.tip.hide()

		this.btns
			.text((d: any) =>
				!d.getCount || d.showCount == 'hide'
					? d.label
					: d.showCount == 'append'
					? `${d.label} (n=${d.getCount()})`
					: `${d.getCount()} ${d.label}`
			)
			.each(function (this: any, d: any) {
				if (d.updateBtn) d.updateBtn(select(this))
			})

		const s = this.parent.settings.matrix || this.parent.config.settings.matrix
		const min = this.parent.computedSettings.zoomMin
		const max = this.parent.computedSettings.zoomMax
		const increment = Math.max(0.01, Number((min / max).toFixed(2)))

		const d = this.parent.dimensions
		if (this.zoomApi)
			this.zoomApi.update({
				value: s.zoomLevel.toFixed(2),
				min: min.toFixed(2),
				max: max.toFixed(2),
				increment,
				step: s.zoomStep || 1
			})

		if (this.svgScrollApi && d) {
			this.svgScrollApi.update({
				x: d.xOffset,
				y: d.yOffset - s.scrollHeight,
				totalWidth: d.zoomedMainW,
				visibleWidth: d.mainw,
				zoomCenter: s.zoomCenterPct * d.mainw - d.seriesXoffset
			})
		}

		if (this.dragToggleApi) {
			this.dragToggleApi.update(s.mouseMode ? { mouseMode: s.mouseMode } : {})
		}
	}

	getSettings() {
		// return control settings that are not tracked in the global app state or plot state
		return {
			mouseMode: this.dragToggleApi.getSettings().mouseMode
		}
	}

	async callback(event: any, d: any) {
		const app = this.opts.app
		const parent = this.opts.parent
		const tables = d.tables || [d]

		event.target.focus()
		app.tip.clear()

		const table = app.tip.d.append('table').attr('class', 'sjpp-controls-table')
		for (const t of tables) {
			//if (d.customHeaderRows) d.customHeaderRows(parent, table)
			if (t.header) {
				table
					.append('tr')
					.selectAll('th')
					.data(t.header)
					.enter()
					.append('th')
					.html((d: any) => d)
			}

			for (const inputConfig of t.rows) {
				const holder = table.append('tr')
				const input = await initByInput[inputConfig.type](
					Object.assign(
						{},
						{
							holder,
							app,
							dispatch: (action: any) => app.dispatch(action),
							id: parent.id,
							debug: this.opts.debug,
							parent
						},
						inputConfig
					)
				)
				input.main(parent.config)
			}

			if (t.customInputs) t.customInputs(this, app, parent, table)
			table.selectAll('select, input, button').attr('tabindex', 0).on('keydown', this.keyboardNavHandler)
		}

		app.tip.showunder(event.target)
	}
}
