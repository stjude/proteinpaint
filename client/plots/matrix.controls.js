import { select } from 'd3-selection'
import { initByInput } from './controls.config'
import { to_svg } from '../src/client'
import { fillTermWrapper, termsettingInit } from '../termsetting/termsetting'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { zoom } from '#dom/zoom'
import { icons } from '#dom/control.icons'

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
		this.setButtons()
		this.setInputGroups()
		if (!this.parent.optionalFeatures.includes('zoom')) return
		this.setZoomInput()
		this.setDragToggle({
			holder: this.opts.holder.append('div').style('display', 'inline-block'),
			target: this.parent.dom.seriesesG
		})
		this.setResetInput()
	}

	setButtons() {
		this.btns = this.opts.holder
			.style('margin', '10px 10px 20px 10px')
			.selectAll('button')
			.data([
				{
					value: 'samples',
					label: `Samples`,
					getCount: () => this.parent.sampleOrder.length
				},
				{
					value: 'anno',
					label: `Variables`,
					getCount: () => this.parent.termOrder.length,
					customInputs: this.appendTermInputs
				},
				{ value: 'styles', label: 'Styles' },
				{ value: 'cols', label: 'Column layout' },
				{ value: 'rows', label: 'Row layout' },
				{ value: 'legend', label: 'Legend layout' },
				//{ label: 'Undo', callback: ()=>this.recover.goto(-1) },
				//{ label: 'Redo', callback: ()=>this.recover.goto(1) },
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
			],

			styles: [
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
			],

			legend: [
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
		}
	}

	main() {
		//this.recover.track()
		this.btns
			.text(d => d.label + (d.getCount ? ` (${d.getCount()})` : ''))
			.style('text-decoration', d => (d.active ? 'underline' : ''))
			.style('color', d => (d.active ? '#3a3' : ''))

		const s = this.parent.config.settings.matrix
		if (this.zoomApi)
			this.zoomApi.update({
				value: Number(((100 * Math.min(s.colw * s.zoomLevel, s.maxColwZoomed)) / s.maxColwZoomed).toFixed(1))
			})
	}

	async callback(event, d) {
		const { clientX, clientY } = event
		const app = this.opts.app
		const parent = this.opts.parent
		const table = app.tip.clear().d.append('table')
		//if (d.customHeaderRows) d.customHeaderRows(parent, table)

		for (const inputConfig of this.inputGroups[d.value]) {
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
		if (d.customInputs) d.customInputs(this, app, parent, table)
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
				min: s.zoomMin, //Math.max(1, Math.floor((100 * 1) / s.maxColw)),
				increment: s.zoomIncrement,
				//max: 5,
				step: s.zoomStep || 5
				//value: s.colw/s.maxColw * 100,
			},
			callback: percentValue => {
				const d = this.parent.dimensions
				const s = this.parent.settings.matrix
				const zoomLevel = (0.01 * percentValue * s.maxColwZoomed) / s.colw
				const zoomCenterPct = 0.5
				const zoomCenter = s.zoomLevel < 1 && zoomLevel > 1 ? Math.round(d.maxMainW / 2) : Math.round(d.mainw / 2)
				const centerCell =
					s.zoomLevel < 1 && zoomLevel > 1
						? this.parent.sampleOrder[Math.floor(this.parent.sampleOrder.length / 2)]
						: this.parent.sampleOrder.find(
								r => r.totalIndex * d.dx + r.grpIndex * s.colgspace >= zoomCenter - d.seriesXoffset
						  )
				this.parent.app.dispatch({
					type: 'plot_edit',
					id: this.parent.id,
					config: {
						settings: {
							matrix: {
								zoomLevel,
								zoomCenterPct,
								zoomIndex: centerCell.totalIndex,
								zoomGrpIndex: centerCell.grpIndex,
								mouseMode: 'zoom'
							}
						}
					}
				})
			}
		})
	}

	setDragToggle(opts = {}) {
		const defaults = {
			mode: 'select',
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
					.on('click', () => {
						opts.target.style('cursor', 'crosshair')
						this.parent.settings.matrix.mouseMode = 'select'
						instance.dom.selectBtn.style('background-color', instance.opts.activeBgColor)
						instance.dom.grabBtn.style('background-color', '')
					}),

				grabBtn: opts.holder
					.append('button')
					.attr('title', 'Click the matrix to drag and move')
					.style('display', 'inline-block')
					.style('width', '25px')
					.style('height', '24.5px')
					.on('click', () => {
						opts.target.style('cursor', 'grab')
						this.parent.settings.matrix.mouseMode = 'pan'
						instance.dom.selectBtn.style('background-color', '')
						instance.dom.grabBtn.style('background-color', instance.opts.activeBgColor)
					})
			}
		}

		//icons.crosshair(instance.dom.selectBtn, { width: 18, height: 18, transform: 'translate(50,50)' })
		icons.arrowPointer(instance.dom.selectBtn, { width: 14, height: 14, transform: 'translate(50,50)' })
		icons.grab(instance.dom.grabBtn, { width: 14, height: 14, transform: 'translate(30,50)' })
	}

	setResetInput() {
		const holder = this.opts.holder.append('div').style('display', 'inline-block') //.style('margin-left', '50px')
		holder
			.append('button')
			.html('Reset')
			.on('click', () => {
				const s = this.parent.settings.matrix
				const d = this.parent.dimensions
				s.mouseMode = 'zoom'
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
}
