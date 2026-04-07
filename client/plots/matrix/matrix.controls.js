import { initByInput } from '#plots/controls.config.js'
import { zoom, icons, svgScroll } from '#dom'
import { select } from 'd3-selection'
import { TermTypes } from '#shared/terms.js'
import { setSamplesBtn, updateSamplesControls } from './matrix.controls.samples'
import { setGenesBtn, addGeneInputs, appendGeneInputs, addGenesetInput, setMenuBackBtn, setTermGroupSelector } from './matrix.controls.genes'
import { setVariablesBtn, appendDictInputs, addDictMenu, submitLst } from './matrix.controls.variables'
import { setDimensionsBtn } from './matrix.controls.dimensions'
import { setLegendBtn } from './matrix.controls.legend'
import { setMutationBtn, generateMutationItems } from './matrix.controls.mutations'
import { setCNVBtn, generateCNVItems } from './matrix.controls.cnv'
import { setDownloadBtn } from './matrix.controls.download'

export class MatrixControls {
	constructor(opts, appState) {
		this.type = 'matrixControls'
		this.opts = opts
		this.parent = opts.parent
		this.overrides = {}

		this.opts.holder.style('margin', '10px 10px 20px 10px').style('white-space', 'nowrap')
		const state = this.parent.getState(appState)
		const s = state.config.settings.matrix
		if (this.parent.setClusteringBtn)
			this.parent.setClusteringBtn(this.opts.holder, (event, data) => this.callback(event, data))
		this.setSamplesBtn(s)
		if (
			state.termdbConfig?.allowedTermTypes?.includes(TermTypes.GENE_VARIANT) ||
			state.termdbConfig.queries.snvindel ||
			(this.parent.chartType == 'hierCluster' && this.parent.config.dataType == TermTypes.GENE_EXPRESSION)
		) {
			this.setGenesBtn(s)
		}
		if (s.addMutationCNVButtons && this.parent.chartType !== 'hierCluster') {
			this.setMutationBtn()
			this.setCNVBtn()
		}
		this.setVariablesBtn(s)
		this.setDimensionsBtn(s)
		this.setLegendBtn(s)
		this.setDownloadBtn(s)
		this.setZoomInput()
		this.setDragToggle({
			holder: this.opts.holder.append('div').style('display', 'inline-block'),
			target: this.parent.dom.seriesesG
		})
		this.setSvgScroll(state)

		this.keyboardNavHandler = async event => {
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
			.filter(d => d && d.label)
			.on(`keyup.matrix-${this.parent.id}`, this.keyboardNavHandler)
	}

	setSamplesBtn(s) {
		setSamplesBtn(this, s)
	}

	setGenesBtn(s) {
		setGenesBtn(this, s)
	}

	setVariablesBtn(s) {
		setVariablesBtn(this, s)
	}

	setDimensionsBtn(s) {
		setDimensionsBtn(this, s)
	}

	setLegendBtn(s) {
		setLegendBtn(this, s)
	}

	// Mutation button for selecting mutations to display on the matrix
	setMutationBtn() {
		setMutationBtn(this)
	}

	// CNV button for selecting the CNVs to display on the matrix
	setCNVBtn() {
		setCNVBtn(this)
	}

	setDownloadBtn(s) {
		setDownloadBtn(this, s)
	}

	main(overrides = {}) {
		this.overrides = overrides
		this.parent.app.tip.hide()

		this.btns
			.text(d =>
				!d.getCount || d.showCount == 'hide'
					? d.label
					: d.showCount == 'append'
					? `${d.label} (n=${d.getCount()})`
					: `${d.getCount()} ${d.label}`
			)
			.each(function (d) {
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

	async callback(event, d) {
		const { clientX, clientY } = event
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
					.html(d => d)
			}

			for (const inputConfig of t.rows) {
				const holder = table.append('tr')
				const input = await initByInput[inputConfig.type](
					Object.assign(
						{},
						{
							holder,
							app,
							dispatch: action => app.dispatch(action),
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
			table.selectAll('select, input, button').attr('tabindex', 0).on('keydown', self.keyboardNavHandler)
		}

		app.tip.showunder(event.target)
	}

	prependInfo(table, header, value) {
		const tr = table.append('tr')
		tr.append('td').text(header).attr('class', 'sja-termdb-config-row-label')
		tr.append('td').text(value)
	}

	async addGeneInputs(self, app, parent, table) {
		return addGeneInputs(self, app, parent, table)
	}
	async appendGeneInputs(self, app, parent, table, geneInputType) {
		return appendGeneInputs(self, app, parent, table, geneInputType)
	}

	addGenesetInput(app, parent, tr, geneInputType) {
		return addGenesetInput(this, app, parent, tr, geneInputType)
	}

	setMenuBackBtn(holder, callback, label) {
		return setMenuBackBtn(holder, callback, label)
	}

	setTermGroupSelector(holder, tg) {
		return setTermGroupSelector(this, holder, tg)
	}

	appendDictInputs(self, app, parent, table) {
		return appendDictInputs(self, app, parent, table)
	}

	generateCNVItems(self, app, parent, table) {
		return generateCNVItems(self, app, parent, table)
	}

	generateMutationItems(self, app, parent, table) {
		return generateMutationItems(self, app, parent, table)
	}

	updateSamplesControls(self, app, parent, table) {
		return updateSamplesControls(self, app, parent, table)
	}

	async addDictMenu(app, parent, holder = undefined) {
		return addDictMenu(this, app, parent, holder)
	}

	async submit_lst(termlst) {
		return submitLst(this, termlst)
	}

	setZoomInput() {
		const holder = this.opts.holder.append('div').style('display', 'inline-block').style('margin-left', '50px')
		const s = this.parent.settings.matrix || this.parent.config.settings.matrix
		this.zoomApi = zoom({
			holder,
			title:
				'Zoom factor relative to the ideal column width, as computed for the number of columns versus available screen width',
			unit: '',
			width: '80px',
			settings: {
				min: 0.1, // will be determined once the auto-computed width is determined
				max: 1, // will be determined once the auto-computed width is determined
				value: 1,
				increment: s.zoomIncrement,
				step: s.zoomStep || 5
			},
			callback: zoomLevel => {
				const p = this.parent
				const d = p.dimensions
				const s = p.settings.matrix
				const c = p.getVisibleCenterCell(0)
				p.app.dispatch({
					type: 'plot_edit',
					id: p.id,
					config: {
						settings: {
							matrix: {
								zoomLevel,
								zoomCenterPct: 0.5,
								zoomIndex: c.totalIndex,
								zoomGrpIndex: c.grpIndex
							}
						}
					}
				})
			},
			reset: () => {
				const s = this.parent.settings.matrix
				const d = this.parent.dimensions
				this.parent.app.dispatch({
					type: 'plot_edit',
					id: this.parent.id,
					config: {
						settings: {
							matrix: {
								zoomLevel: 1,
								zoomCenterPct: 0
							}
						}
					}
				})
			}
		})
	}

	setDragToggle(opts = {}) {
		const defaults = {
			mouseMode: 'select',
			activeBgColor: 'rgb(255, 255, 255)'
		}

		// hardcode to always be in select mode on first render
		opts.target.style('cursor', 'default')

		const instance = {
			opts: Object.assign({}, defaults, opts),
			//holder: opts.holder.append('div').style('display', 'inline-block')
			dom: {
				selectBtn: opts.holder
					.append('button')
					.attr('aria-label', 'Click the matrix to select data')
					.style('display', 'inline-block')
					.style('width', '25px')
					.style('height', '24.5px')
					.style('background-color', defaults.activeBgColor)
					.on('click', () => setMode('select')),

				grabBtn: opts.holder
					.append('button')
					.attr('aria-label', 'Click the matrix to drag and move')
					.style('display', 'inline-block')
					.style('width', '25px')
					.style('height', '24.5px')
					.on('click', () => setMode('pan'))
			}
		}

		//icons.crosshair(instance.dom.selectBtn, { width: 18, height: 18, transform: 'translate(50,50)' })
		icons.arrowPointer(instance.dom.selectBtn, { width: 14, height: 14, transform: 'translate(50,50)' })
		icons.grab(instance.dom.grabBtn, { width: 14, height: 14, transform: 'translate(30,50)' })

		const self = this
		function setMode(m) {
			instance.opts.mouseMode = m
			self.parent.settings.matrix.mouseMode = m
			opts.target.style('cursor', m == 'select' ? 'default' : 'grab')
			instance.dom.selectBtn.style('background-color', m == 'select' ? instance.opts.activeBgColor : '')
			instance.dom.grabBtn.style('background-color', m == 'pan' ? instance.opts.activeBgColor : '')
		}

		// NOTE:
		this.dragToggleApi = {
			update(s = {}) {
				Object.assign(instance.opts, s)
				setMode(instance.opts.mouseMode)
			},
			getSettings() {
				return {
					mouseMode: instance.opts.mouseMode
				}
			}
		}
	}

	setSvgScroll(state) {
		this.svgScrollApi = svgScroll({
			holder: this.parent.dom.scroll,
			height: state.config.settings.matrix.scrollHeight,
			callback: (dx, eventType) => {
				const p = this.parent
				const s = p.settings.matrix
				const d = p.dimensions
				if (eventType == 'move') {
					p.dom.seriesesG.attr('transform', `translate(${d.xOffset + d.seriesXoffset - dx},${d.yOffset})`)
					p.clusterRenderer.translateElems(-dx, s, d)
					p.layout.top.attr.adjustBoxTransform(-dx)
					p.layout.btm.attr.adjustBoxTransform(-dx)
					if (p.dom.topDendrogram) {
						p.dom.topDendrogram.attr('transform', `translate(${p.topDendroX - dx},0)`)
					}
				} else if (eventType == 'up') {
					const c = p.getVisibleCenterCell(-dx)
					p.app.dispatch({
						type: 'plot_edit',
						id: p.id,
						config: {
							settings: {
								matrix: {
									zoomCenterPct: 0.5,
									zoomIndex: c.totalIndex,
									zoomGrpIndex: c.grpIndex
								}
							}
						}
					})
				}
			}
		})
	}
}
