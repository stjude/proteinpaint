import { initByInput } from './controls.config'
import { to_svg } from '../src/client'
import { fillTermWrapper, termsettingInit } from '../termsetting/termsetting'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { zoom } from '#dom/zoom'
import { icons } from '#dom/control.icons'
import { svgScroll } from '#dom/svg.scroll'

const tip = new Menu({ padding: '' })

export class MatrixControls {
	constructor(opts, appState) {
		this.type = 'matrixControls'
		this.opts = opts
		this.parent = opts.parent
		/* 
			for now, use the recoverInit at the global,
			may use subapp state/recovery later
		 */
		//this.recover = new Recover({app: opts.app})
		const state = this.parent.getState(appState)
		this.setButtons(state.config.settings.matrix)
		this.setZoomInput()
		this.setDragToggle({
			holder: this.opts.holder.append('div').style('display', 'inline-block'),
			target: this.parent.dom.seriesesG
		})
		this.setResetInput()
		this.setSvgScroll(state)
	}

	setButtons(s) {
		this.btns = this.opts.holder
			.style('margin', '10px 10px 20px 10px')
			.selectAll('button')
			.data([
				{
					label: s.controlLabels.samples || `Samples`,
					getCount: () => this.parent.sampleOrder.length,
					rows: [
						{
							label: 'Sort samples',
							type: 'radio',
							chartType: 'matrix',
							settingsKey: 'sortSamplesBy',
							options: [{ label: 'as-listed', value: 'asListed' }, { label: 'selected terms', value: 'selectedTerms' }]
						},
						{
							label: 'Maximum #samples',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'maxSample'
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
							},
							processInput: tw => {
								if (tw) fillTermWrapper(tw)
							}
						},
						{
							label: 'Sample name regex filter',
							type: 'text',
							chartType: 'matrix',
							settingsKey: 'sampleNameFilter'
						}
					]
				},
				{
					label: s.controlLabels.terms || `Variables`,
					getCount: () => this.parent.termOrder.length,
					customInputs: this.appendTermInputs,
					rows: [
						/*{
							label: 'Terms as columns',
							boxLabel: '',
							type: 'checkbox',
							chartType: 'matrix',
							settingsKey: 'transpose'
						},*/
						{
							label: 'Display sample counts for gene',
							boxLabel: '',
							type: 'checkbox',
							chartType: 'matrix',
							settingsKey: 'samplecount4gene'
						},
						/*{
							NOTE: this is only by term group, not global to all rows
							label: 'Minimum #samples',
							type: 'number',
							chartType: 'matrix',
							settingsKey: 'minNumSamples',
							title: 'Minimum number of hits for a row to be visible'
						},*/
						{
							label: 'Sort terms',
							type: 'radio',
							chartType: 'matrix',
							settingsKey: 'sortTermsBy',
							options: [{ label: 'as-listed', value: 'asListed' }, { label: 'by sample count', value: 'sampleCount' }]
						}
					]
				},

				{
					label: 'Styles',
					rows: [
						{
							label: 'Cell encoding',
							type: 'radio',
							chartType: 'matrix',
							settingsKey: 'cellEncoding',
							options: [{ label: 'Default', value: '' }, { label: 'Oncoprint', value: 'oncoprint' }]
						},
						{
							label: 'Background color',
							type: 'color',
							chartType: 'matrix',
							settingsKey: 'cellbg'
						}
					]
				},

				// { value: 'cols', label: 'Column layout' },
				// { value: 'rows', label: 'Row layout' },
				{
					label: 'Dimensions',

					tables: [
						/*{
							header: ['Zoom', 'Min', 'Max'],
							rows: [
								{
									label: 'Column Width',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [
										{ settingsKey: 'colwMin', min: 0, max: 24, step: 0.2 },
										{ settingsKey: 'colwMax', min: 10, max: 40, step: 0.2 }
									]
								}
							]
						},*/
						{
							header: ['Cells', 'Columns', 'Rows'],
							rows: [
								{
									label: 'Row height',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [{ label: 'N/A' }, { settingsKey: 'rowh', min: 8, max: 30, step: 1 }]
								},
								{
									label: 'Min col. width',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [{ settingsKey: 'colwMin', min: 0, max: 24, step: 0.2 }, { label: 'N/A' }]
								},
								{
									label: 'Max col. width',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [{ settingsKey: 'colwMax', min: 1, max: 24, step: 0.2 }, { label: 'N/A' }]
								},
								{
									label: 'Spacing',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [
										{ settingsKey: 'colspace', min: 0, max: 20, step: 1 },
										{ settingsKey: 'rowspace', min: 0, max: 20, step: 1 }
									]
								},
								{
									label: 'Group spacing',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [
										{ settingsKey: 'colgspace', min: 0, max: 20, step: 1 },
										{ settingsKey: 'rowgspace', min: 0, max: 20, step: 1 }
									]
								}
							]
						},
						{
							header: ['Labels', 'Columns', 'Rows'],
							rows: [
								{
									label: 'Spacing',
									type: 'number',
									width: 50,
									chartType: 'matrix',
									inputs: [
										{ settingsKey: 'collabelgap', min: 0, max: 20, step: 1 },
										{ settingsKey: 'rowlabelgap', min: 0, max: 20, step: 1 }
									]
								}
							]
						}
					]
				},

				{
					label: 'Legend layout',
					rows: [
						//ontop: false,
						{
							label: 'Font size',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'fontsize'
						},
						{
							label: 'Line height',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'lineh'
						},
						{
							label: 'Icon height',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'iconh'
						},
						{
							label: 'Icon width',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'iconw'
						},
						{
							label: 'Left margin',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'padleft'
						},
						/*{
							label: 'Bottom margin',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'padbtm'
						},*/
						{
							label: 'Item left pad',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'padx'
						},
						{
							label: 'Item layout',
							type: 'checkbox',
							chartType: 'legend',
							settingsKey: 'linesep',
							boxLabel: 'Line separated'
						},
						{
							label: 'Left indent',
							type: 'number',
							chartType: 'legend',
							settingsKey: 'hangleft'
						}
					]
				},

				{
					label: 'Download SVG',
					callback: () => to_svg(this.opts.getSvg(), 'matrix', { apply_dom_styles: true })
				}
			])
			.enter()
			.append('button')
			.style('margin', '2px 0')
			.property('disabled', d => d.disabled)
			.text(d => d.label)
			.on('click', (event, d) => (d.callback ? d.callback(event) : this.callback(event, d)))
	}

	setInputGroups() {
		this.inputGroups = {
			/*cols: [
				{
					label: 'Column label pad',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'collabelpad'
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
					label: 'Row label pad',
					type: 'number',
					chartType: 'matrix',
					settingsKey: 'rowlabelpad'
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
			],*/
		}
	}

	main() {
		//this.recover.track()
		this.btns
			.text(d => d.label + (d.getCount ? ` (${d.getCount()})` : ''))
			.style('text-decoration', d => (d.active ? 'underline' : ''))
			.style('color', d => (d.active ? '#3a3' : ''))

		const s = this.parent.config.settings.matrix
		const d = this.parent.dimensions
		if (this.zoomApi)
			this.zoomApi.update({
				value: Number(((100 * Math.min(s.colw * s.zoomLevel, s.colwMax)) / s.colwMax).toFixed(1))
			})

		if (this.svgScrollApi) {
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

		app.tip.clear()

		for (const t of tables) {
			const table = app.tip.d.append('table').attr('class', 'sjpp-controls-table')
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
				const input = await initByInput[inputConfig.type](
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

			if (t.customInputs) t.customInputs(this, app, parent, table)
		}

		app.tip.showunder(event.target)
	}

	prependInfo(table, header, value) {
		const tr = table.append('tr')
		tr.append('td')
			.text(header)
			.attr('class', 'sja-termdb-config-row-label')
		tr.append('td').text(value)
	}

	appendTermInputs(self, app, parent, table) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = 0
		if (parent.config.termgroups.length > 1) {
			self.addTermGroupSelector(app, parent, table.append('tr'))
		}
		self.addGeneSearch(app, parent, table.append('tr'))
		if (app.opts.genome?.termdbs) {
			for (const key in app.opts.genome.termdbs) {
				self.addMsigdbMenu(app, parent, table.append('tr'), key)
			}
		}
		self.addDictMenu(app, parent, table.append('tr'))
	}

	addTermGroupSelector(app, parent, tr) {
		const td = tr.append('td').attr('colspan', 2)
		td.append('span').html('Add to term group &nbsp;')
		const tg = parent.config.termgroups
		td.append('select')
			.selectAll('option')
			.data(tg)
			.enter()
			.append('option')
			.attr('selected', (d, i) => tg.length < 2 || parent.selectedGroup === i)
			.attr('value', (d, i) => i)
			.html((d, i) => d.name || `Unlabeled group #${i + 1}`)
			.on('change', (d, i) => {
				parent.selectedGroup = i
			})
	}

	addGeneSearch(app, parent, tr) {
		tr.append('td')
			.attr('class', 'sja-termdb-config-row-label')
			.html('Add a single gene &nbsp;')

		const coordInput = addGeneSearchbox({
			tip,
			genome: app.opts.genome,
			row: tr.append('td'),
			geneOnly: true,
			callback: () => {
				if (!coordInput.geneSymbol) throw 'geneSymbol missing'
				// TODO: see above for input to select which group to add the gene,
				// right now it assumes the first group; also may use fillTermWrapper
				const tw = {
					term: {
						$id: get$id(),
						name: coordInput.geneSymbol,
						type: 'geneVariant'
					}
				}
				parent.config.termgroups[parent.selectedGroup].lst.push(tw)

				app.dispatch({
					type: 'plot_edit',
					id: parent.id,
					config: {
						termgroups: parent.config.termgroups
					}
				})
			}
		})
	}

	// should be fine to name this method Msigdb as this is the only eligible geneset db for now
	addMsigdbMenu(app, parent, tr, termdbKey) {
		const tdb = app.opts.genome.termdbs[termdbKey]

		const td = tr.append('td').attr('colspan', 2)
		const span = td
			.append('span')
			.style('cursor', 'pointer')
			.html(`Select an ${tdb.label} gene group`)
			.on('click', async () => {
				tip.clear()
				const termdb = await import('../termdb/app')
				termdb.appInit({
					holder: tip.d,
					state: {
						dslabel: termdbKey,
						genome: app.opts.genome.name,
						nav: {
							header_mode: 'search_only'
						}
					},
					tree: {
						click_term: term => {
							const geneset = term._geneset
							const tws = geneset.map(d => {
								const tw = {
									$id: get$id(),
									term: {
										name: d.symbol,
										type: 'geneVariant'
									},
									q: {}
								}
								return tw
							})

							// TODO: see above for input to select which group to add the gene
							// right not it assumes the first group
							parent.config.termgroups[parent.selectedGroup].lst.push(...tws)

							app.dispatch({
								type: 'plot_edit',
								id: parent.id,
								config: {
									termgroups: parent.config.termgroups
								}
							})

							tip.hide()
							app.tip.hide()
						}
					}
				})

				tip.showunder(span.node())
			})
	}

	async addDictMenu(app, parent, tr) {
		const td = tr
			.append('td')
			.attr('colspan', 2)
			.style('padding-left', 0)

		const pill = await termsettingInit({
			vocabApi: app.vocabApi,
			placeholder: 'Select a dictionary term',
			placeholderIcon: '',
			holder: td,
			debug: this.opts.debug,
			callback: tw => {
				if (tw && !tw.q) throw 'data.q{} missing from pill callback'
				parent.config.termgroups[parent.selectedGroup].lst.push(tw)
				app.dispatch({
					type: 'plot_edit',
					id: parent.id,
					config: {
						termgroups: parent.config.termgroups
					}
				})

				tip.hide()
				app.tip.hide()
			},
			customFillTw(tw) {
				const term = tw.term
				if (term.type == 'integer' || term.type == 'float') {
					// is numeric term, to plot individual values as barchart, must set below
					tw.q.mode = 'continuous'
					tw.settings = { barh: 30, gap: 0 } // TODO improve this hardcoded attributes
				}
			}
		})
	}

	setZoomInput() {
		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', '50px')
		const s = this.parent.config.settings.matrix
		this.zoomApi = zoom({
			holder,
			settings: {
				min: (100 * s.colwMin) / s.colwMax, //s.zoomMin, //Math.max(1, Math.floor((100 * 1) / s.colwMax)),
				increment: s.zoomIncrement,
				max: 100,
				step: s.zoomStep || 5,
				value: ((s.colw / s.colwMax) * 100).toFixed(1)
			},
			callback: percentValue => {
				const p = this.parent
				const d = p.dimensions
				const s = p.settings.matrix
				const zoomLevel = (0.01 * percentValue * s.colwMax) / s.colw
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
			}
		})
	}

	setDragToggle(opts = {}) {
		const defaults = {
			mouseMode: 'select',
			activeBgColor: 'rgb(240, 236, 123)'
		}

		// hardcode to always be in select mode on first render
		opts.target.style('cursor', 'crosshair')

		const instance = {
			opts: Object.assign({}, defaults, opts),
			//holder: opts.holder.append('div').style('display', 'inline-block')
			dom: {
				selectBtn: opts.holder
					.append('button')
					.attr('title', 'Click the matrix to select data')
					.style('display', 'inline-block')
					.style('width', '25px')
					.style('height', '24.5px')
					.style('background-color', defaults.activeBgColor)
					.on('click', () => setMode('select')),

				grabBtn: opts.holder
					.append('button')
					.attr('title', 'Click the matrix to drag and move')
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
			opts.target.style('cursor', m == 'select' ? 'crosshair' : 'grab')
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

	setResetInput() {
		const holder = this.opts.holder.append('div').style('display', 'inline-block') //.style('margin-left', '50px')
		holder
			.append('button')
			.html('Reset')
			.on('click', () => {
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
			})
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
					p.dom.clipRect.attr('x', Math.abs(d.seriesXoffset - dx) / d.zoomedMainW)
					p.layout.top.attr.adjustBoxTransform(-dx)
					p.layout.btm.attr.adjustBoxTransform(-dx)
				} else if (eventType == 'up') {
					const c = p.getVisibleCenterCell(-dx)
					p.app.dispatch({
						type: 'plot_edit',
						id: p.id,
						config: {
							settings: {
								matrix: {
									zoomCenterPct: s.zoomCenterPct,
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
