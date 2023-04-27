import { initByInput } from './controls.config'
import { to_svg } from '../src/client'
import { fillTermWrapper, termsettingInit, get$id } from '../termsetting/termsetting'
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

		this.opts.holder.style('margin', '10px 10px 20px 10px').style('white-space', 'nowrap')
		const state = this.parent.getState(appState)
		const s = state.config.settings.matrix
		this.setSamplesBtn(s)
		this.setGenesBtn(s)
		this.setVariablesBtn(s)
		this.setDimensionsBtn(s)
		this.setLegendBtn(s)
		this.setDownloadBtn(s)
		this.btns = this.opts.holder.selectAll('button').filter(d => d && d.label)

		this.setZoomInput()
		this.setDragToggle({
			holder: this.opts.holder.append('div').style('display', 'inline-block'),
			target: this.parent.dom.seriesesG
		})
		this.setSvgScroll(state)
	}

	setSamplesBtn(s) {
		const sampleLabel = s.controlLabels.samples.toLowerCase() || 'samples'
		this.opts.holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: s.controlLabels.samples || `Samples`,
				getCount: () => this.parent.sampleOrder.length,
				rows: [
					{
						label: `Sort ${sampleLabel}`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'sortSamplesBy',
						options: Object.values(s.sortOptions).sort((a, b) => a.order - b.order),
						labelDisplay: 'block'
					},
					{
						label: `Maximum #${sampleLabel}`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'maxSample'
					},
					{
						label: `Group ${sampleLabel} by`,
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
						},
						getBodyParams: () => {
							const currentGeneNames = this.parent.termOrder
								.filter(t => t.tw.term.type === 'geneVariant')
								.map(t => t.tw.term.name)
								.sort()
							return { currentGeneNames }
						}
					}
					/*{
						label: 'Sample name regex filter',
						type: 'text',
						chartType: 'matrix',
						settingsKey: 'sampleNameFilter'
					}*/
				]
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setGenesBtn(s) {
		this.opts.holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: 'Genes',
				getCount: () => this.parent.termOrder.filter(t => t.tw.term.type == 'geneVariant').length,
				customInputs: this.appendGeneInputs,
				rows: [
					{
						label: 'Display sample counts for gene',
						boxLabel: '',
						type: 'checkbox',
						chartType: 'matrix',
						settingsKey: 'samplecount4gene'
					},
					{
						label: 'Rendering style',
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'cellEncoding',
						options: [{ label: 'Default', value: '' }, { label: 'Oncoprint', value: 'oncoprint' }]
					},
					/*{
						label: 'Terms as columns',
						boxLabel: '',
						type: 'checkbox',
						chartType: 'matrix',
						settingsKey: 'transpose'
					},*/
					/*{
						NOTE: this is only by term group, not global to all rows
						label: 'Minimum #samples',
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'minNumSamples',
						title: 'Minimum number of hits for a row to be visible'
					},*/
					{
						label: 'Sort genes',
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'sortTermsBy',
						options: [{ label: 'as-listed', value: 'asListed' }, { label: 'by sample count', value: 'sampleCount' }]
					}
				]
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setVariablesBtn(s) {
		this.opts.holder
			.append('button')
			.datum({
				label: s.controlLabels.terms || `Variables`,
				//getCount: () => this.parent.termOrder.filter(t => t.tw.term.type != 'geneVariant').length.length,
				customInputs: this.appendDictInputs,
				rows: []
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setDimensionsBtn(s) {
		this.opts.holder
			.append('button')
			.datum({
				label: 'Cell layout',
				tables: [
					{
						rows: [
							{
								label: 'Grid',
								type: 'checkbox',
								boxLabel: 'show',
								// v===true means property('checked') and convert to recognized 'rect' value for dispatch
								// otherwise, compared value to 'rect' to set the current value of the checkbox
								// note: the non-boolean showGrid values allow keeping the hidden value='pattern' option for benchmark tests
								processInput: v => (v === true ? 'rect' : v === 'rect'),
								chartType: 'matrix',
								settingsKey: 'showGrid',
								colspan: 2,
								align: 'center'
								// for testing/benchmarking
								// type: 'radio',
								// options: [
								// 	{
								// 		label: 'hide',
								// 		value: ''
								// 	},
								// 	{
								// 		label: 'lines',
								// 		value: 'pattern' // needs debugging for when s.rowh or d.colw does not apply to all rows
								// 	},
								// 	{
								// 		label: 'rect',
								// 		value: 'rect'
								// 	}
								// ]
							},
							{
								label: 'Outline color',
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'outlineStroke',
								colspan: 2,
								align: 'center'
								//getDisplayStyle: plot => this.parent.settings.matrix.showGrid ? '' : 'none'
							},
							{
								label: 'Grid line color',
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'gridStroke',
								colspan: 2,
								align: 'center'
								//getDisplayStyle: plot => this.parent.settings.matrix.showGrid ? '' : 'none'
							},
							{
								label: 'Background color',
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'cellbg',
								colspan: 2,
								align: 'center'
							},
							{
								label: 'Use canvas if #samples exceeds',
								type: 'number',
								chartType: 'matrix',
								settingsKey: 'svgCanvasSwitch',
								colspan: 2,
								align: 'center',
								width: 60,
								min: 0,
								max: 10000,
								step: 1
							},
							{
								label: 'Canvas mininum pixel width',
								type: 'checkbox',
								boxLabel: 'apply',
								chartType: 'matrix',
								settingsKey: 'useMinPixelWidth',
								colspan: 2,
								align: 'center',
								getDisplayStyle: () => (this.parent.settings.matrix.useCanvas ? '' : 'none')
							}
						]
					},
					{
						header: ['Cells', 'Columns', 'Rows'],
						rows: [
							{
								label: 'Row height',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [{ label: 'N/A' }, { settingsKey: 'rowh', min: 8, max: 30, step: 1 }]
							},
							{
								label: 'Min col. width',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [{ settingsKey: 'colwMin', min: 0.1, max: 16, step: 0.2 }, { label: 'N/A' }]
							},
							{
								label: 'Max col. width',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [{ settingsKey: 'colwMax', min: 1, max: 24, step: 0.2 }, { label: 'N/A' }]
							},
							{
								label: 'Spacing',
								type: 'number',
								width: 50,
								align: 'center',
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
								align: 'center',
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
								label: 'Offset',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [
									{ settingsKey: 'collabelgap', min: 0, max: 20, step: 1 },
									{ settingsKey: 'rowlabelgap', min: 0, max: 20, step: 1 }
								]
							},
							{
								label: 'Spacing',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [
									{ settingsKey: 'collabelpad', min: 0, max: 20, step: 1 },
									{ settingsKey: 'rowlabelpad', min: 0, max: 20, step: 1 }
								]
							},
							{
								label: 'Minimum size',
								type: 'number',
								width: 50,
								align: 'center',
								colspan: 2,
								chartType: 'matrix',
								settingsKey: 'minLabelFontSize',
								min: 0,
								max: 24,
								step: 0.1
							},
							{
								label: 'Maximum size',
								type: 'number',
								width: 50,
								align: 'center',
								colspan: 2,
								chartType: 'matrix',
								settingsKey: 'maxLabelFontSize',
								min: 0,
								max: 24,
								step: 0.1
							},
							{
								label: 'Individual label<br/>position',
								type: 'radio',
								width: 50,
								chartType: 'matrix',
								labelDisplay: 'block',
								inputs: [
									{
										settingsKey: 'collabelpos',
										options: [{ label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' }]
									},
									{
										settingsKey: 'rowlabelpos',
										options: [{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }]
									}
								]
							}
						]
					}
				]
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setLegendBtn(s) {
		this.opts.holder
			.append('button')
			.style('margin', '2px 0')
			.datum({
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
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setDownloadBtn(s) {
		this.opts.holder
			.append('button')
			.style('margin', '2px 0')
			//.property('disabled', d => d.disabled)
			.text('Download')
			.on('click', () => to_svg(this.opts.getSvg(), 'matrix', { apply_dom_styles: true }))
	}

	main() {
		this.parent.app.tip.hide()

		this.btns
			.text(d => d.label + (d.getCount ? ` (${d.getCount()})` : ''))
			.style('text-decoration', d => (d.active ? 'underline' : ''))
			.style('color', d => (d.active ? '#3a3' : ''))

		const s = this.parent.config.settings.matrix
		const d = this.parent.dimensions
		if (this.zoomApi)
			this.zoomApi.update({
				value: s.zoomLevel.toFixed(1),
				min: s.colwMin / s.colw,
				max: s.colwMax / s.colw,
				increment: s.zoomIncrement,
				step: s.zoomStep || 1
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

	async appendGeneInputs(self, app, parent, table) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = 0
		if (parent.config.termgroups.length > 1) {
			self.addTermGroupSelector(app, parent, table.append('tr'))
		}
		self.addGeneSearch(app, parent, table.append('tr'))

		if (parent.opts.customInputs?.genes) {
			for (const inputConfig of parent.opts.customInputs?.genes) {
				inputConfig.chartType = 'matrix'
				const input = await initByInput[inputConfig.type](
					Object.assign(
						{},
						{
							holder: table.append('tr'),
							//dispatch: app.dispatch,
							id: parent.id,
							//instanceNum: this.instanceNum,
							debug: self.opts.debug,
							parent
						},
						inputConfig
					)
				)
				input.main(parent.config)
				//parent.opts.customInputs.genes(table.append('tr').append('td').attr('colspan', 2).style('text-align', 'center'))
			}
		}

		if (app.opts.genome?.termdbs) {
			for (const key in app.opts.genome.termdbs) {
				self.addMsigdbMenu(app, parent, table.append('tr'), key)
			}
		}
	}

	appendDictInputs(self, app, parent, table) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = 0
		if (parent.config.termgroups.length > 1) {
			self.addTermGroupSelector(app, parent, table.append('tr'))
		}
		self.addDictMenu(app, parent)
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
					$id: get$id(),
					term: {
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
		app.tip.clear()

		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: app.tip.d,
			vocabApi: this.parent.app.vocabApi,
			state: {
				vocab: this.parent.state.vocab,
				activeCohort: this.parent.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: {
					usecase: { target: 'matrix', detail: 'termgroups' }
				}
			},
			tree: {
				submit_lst: termlst => {
					this.submit_lst(termlst)
					app.tip.hide()
				}
			}
		})
	}

	async submit_lst(termlst) {
		const newterms = await Promise.all(
			termlst.map(async _term => {
				const term = structuredClone(_term)
				const tw = 'id' in term ? { id: term.id, term } : { term }
				await fillTermWrapper(tw)
				return tw
			})
		)

		const s = this.parent.settings.matrix
		const termgroups = structuredClone(this.parent.config.termgroups)
		const i = termgroups.findIndex(g => g.name == 'Variables')
		if (i !== -1) {
			const grp = termgroups[i]
			grp.lst.push(...newterms)
			this.parent.app.dispatch({
				type: 'plot_nestedEdits',
				id: this.parent.id,
				edits: [
					{
						nestedKeys: ['termgroups', i, 'lst'],
						value: grp.lst
					}
				]
			})
		} else {
			const grp = { name: 'Variables', lst: newterms }
			termgroups.unshift(grp)
			this.parent.app.dispatch({
				type: 'plot_edit',
				id: this.parent.id,
				config: { termgroups }
			})
		}
	}

	setZoomInput() {
		const holder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', '50px')
		const s = this.parent.config.settings.matrix
		this.zoomApi = zoom({
			holder,
			title:
				'Zoom factor relative to the ideal column width, as computed for the number of columns versus available screen width',
			unit: '',
			width: '80px',
			settings: {
				value: 1,
				min: 0.1, // will be determined once the auto-computed width is determined
				max: 10, // will be determined once the auto-computed width is determined
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
