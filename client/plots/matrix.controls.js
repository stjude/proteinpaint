import { initByInput } from './controls.config'
import { to_svg } from '../src/client'
import { fillTermWrapper, get$id } from '#termsetting'
import { Menu } from '#dom/menu'
import { zoom } from '#dom/zoom'
import { icons } from '#dom/control.icons'
import { svgScroll } from '#dom/svg.scroll'
import { showGenesetEdit } from '../dom/genesetEdit.ts' // cannot use '#dom/', breaks

const tip = new Menu({ padding: '' })

export class MatrixControls {
	constructor(opts, appState) {
		this.type = 'matrixControls'
		this.opts = opts
		this.parent = opts.parent

		this.opts.holder.style('margin', '10px 10px 20px 10px').style('white-space', 'nowrap')
		const state = this.parent.getState(appState)
		const s = state.config.settings.matrix
		if (this.parent.setClusteringBtn)
			this.parent.setClusteringBtn(this.opts.holder, (event, data) => this.callback(event, data))
		this.setSamplesBtn(s)
		this.setGenesBtn(s)
		this.setVariablesBtn(s)
		this.setDimensionsBtn(s)
		this.setLegendBtn(s)
		this.setDownloadBtn(s)

		this.keyboardNavHandler = async event => {
			console.log(32, event.key, event.target.previousSibling, event.target.nextSibling)
			if (event.target.tagName == 'BUTTON') this.keyEventTarget = event.target
			/*if (event.key == 'Tab') {
			} else if (event.key == 'ArrowLeft') {
				if (event.target.previousSibling) event.target.previousSibling.focus()
				else event.target.parentNode.focus()
			} else if (event.key == 'ArrowRight') {
				if (event.target.nextSibling) event.target.nextSibling.focus()
				else if (event.target.parentNode.nextSibling) event.target.parentNode.nextSibling()
			} else if (event.key == 'ArrowDown') { console.log(38, event.target)
				if (event.target.tagName == 'BUTTON') this.parent.app.tip.d.select('input, select, button').node().focus()
				else if (!event.target.firstChild?.querySelectorAll('input').length) {
					if (event.target.nextSibling?.firstChild?.tagName == 'td') event.target.nextSibling?.firstChild.focus()
				}
			} else*/ if (event.key == 'Enter' || event.key == 'ArrowDown') {
				if (event.target.tagName == 'BUTTON') this.parent.app.tip.d.select('input, select').node().focus()
				if (event.target.querySelectorAll('input')?.length) event.target.querySelector('input').focus()
			} else if (event.key == 'Backspace' || event.key == 'ArrowUp') {
				this.keyEventTarget.focus()
			}
		}

		this.btns = this.opts.holder
			.selectAll(':scope>button')
			.filter(d => d && d.label)
			.on(`keyup.matrix-${this.parent.id}`, this.keyboardNavHandler)
			// .on('click.sjpp-btn-focus', function() {
			// 	//this.focus()
			// })
			.on('focus.matrix-keyboard-nav', function (d) {
				this.click()
			})

		this.setZoomInput()
		this.setDragToggle({
			holder: this.opts.holder.append('div').style('display', 'inline-block'),
			target: this.parent.dom.seriesesG
		})
		this.setSvgScroll(state)
	}

	setSamplesBtn(s) {
		const l = s.controlLabels

		this.opts.holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: l.Samples || `Samples`,
				getCount: () => this.parent.sampleOrder.length,
				rows: [
					{
						label: `Sort ${l.Samples}`,
						title: `Set how to sort ${l.samples}`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'sortSamplesBy',
						options: Object.values(s.sortOptions).sort((a, b) => a.order - b.order),
						labelDisplay: 'block',
						getDisplayStyle(plot) {
							return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
						}
					},
					{
						label: `Maximum # ${l.Samples}`,
						title: `Limit the number of displayed ${l.samples}`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'maxSample',
						getDisplayStyle(plot) {
							return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
						}
					},
					{
						label: `Group ${l.Samples} By`,
						title: `Select a variable with discrete values to group ${l.samples}`,
						type: 'term',
						chartType: 'matrix',
						configKey: 'divideBy',
						vocabApi: this.opts.app.vocabApi,
						state: {
							vocab: this.opts.vocab
							//activeCohort: appState.activeCohort
						},
						getDisplayStyle(plot) {
							return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
						},
						processInput: tw => {
							if (tw) fillTermWrapper(tw)
							return tw
						},
						getBodyParams: () => {
							const currentGeneNames = this.parent.termOrder
								.filter(t => t.tw.term.type === 'geneVariant')
								.map(t => t.tw.term.gene || t.tw.term.name) // TODO term.gene replaces term.name
							return { currentGeneNames }
						}
					},
					{
						label: `Sort ${l.Sample} Groups`,
						title: `Set how to sort ${l.sample} groups`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'sortSampleGrpsBy',
						options: [
							{
								label: 'Predefined or Group Name',
								value: 'name',
								title: `Sort by group name`
							},
							{
								label: `${l.Sample} Count`,
								value: 'sampleCount',
								title: `Sort by the number of samples in the group`
							},
							{
								label: `Hits`,
								value: 'hits',
								title: `Sort by the total number of variants for every ${l.sample} in the group`
							}
						],
						getDisplayStyle(plot) {
							return plot.divideBy && !plot.hierCluster ? 'table-row' : 'none'
						}
					},
					{
						label: `${l.Sample} Group Label Character Limit`,
						title: `Truncate the ${l.sample} group label if it exceeds this maximum number of characters`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'sampleGrpLabelMaxChars',
						getDisplayStyle(plot) {
							return plot.divideBy && !plot.hierCluster ? 'table-row' : 'none'
						}
					},
					{
						label: `${l.Sample} Label Character Limit`,
						title: `Truncate the ${l.sample} label if it exceeds this maximum number of characters`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'collabelmaxchars'
					}
				]
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setGenesBtn(s) {
		const l = s.controlLabels
		this.opts.holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: 'Genes',
				getCount: () => this.parent.termOrder.filter(t => t.tw.term.type == 'geneVariant').length,
				customInputs: this.appendGeneInputs,
				rows: [
					{
						label: `Display ${l.Sample} Counts for Gene`,
						title: `Include the ${l.sample} count in the gene label`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'samplecount4gene',
						options: [
							{ label: 'Absolute', value: 'abs' },
							{ label: `Percent`, value: 'pct' },
							{ label: `None`, value: '' }
						]
					},
					// TODO: implement this contol option
					// {
					// 	label: `Exclude From ${l.Sample} Displayed Counts`,
					// 	title: `Do not include these variations/mutations when counting samples for a gene.`,
					// 	type: 'text',
					// 	chartType: 'matrix',
					// 	settingsKey: 'geneVariantCountSamplesSkipMclass',
					// 	processInput: tw => {},
					// },
					{
						label: `Row Group Label Character Limit`,
						title: `Truncate the row group label if it exceeds this maximum number of characters`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'termGrpLabelMaxChars'
					},
					{
						label: `Row Label Character Limit`,
						title: `Truncate the row label if it exceeds this maximum number of characters`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'rowlabelmaxchars'
					},
					{
						label: 'Rendering Style',
						title: `Set how to indicate a ${l.sample}'s applicable variant types in the same matrix cell`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'cellEncoding',
						options: [
							{
								label: 'Stacked',
								value: '',
								title: `Show stacked rectangles in the same matrix cell to render variants for the same ${l.sample} and gene`
							},
							{
								label: 'Oncoprint',
								value: 'oncoprint',
								title: `Show overlapping rectangles in the same matrix cell to render variants for the same ${l.sample} and gene`
							}
						],
						styles: { padding: 0, 'padding-right': '10px', margin: 0 }
					},
					{
						label: 'Sort Genes',
						title: 'Set how to order the genes as rows',
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'sortTermsBy',
						options: [
							{ label: 'By Input Data Order', value: 'asListed' },
							{ label: `By ${l.sample} Count`, value: 'sampleCount' }
						],
						styles: { padding: 0, 'padding-right': '10px', margin: 0 }
					}
				]
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setVariablesBtn(s) {
		const l = s.controlLabels
		this.opts.holder
			.append('button')
			.datum({
				label: s.controlLabels.Terms || `Variables`,
				//getCount: () => this.parent.termOrder.filter(t => t.tw.term.type != 'geneVariant').length.length,
				rows: [
					{
						label: `Row Group Label Max Length`,
						title: `Truncate the row group label if it exceeds this maximum number of characters`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'termGrpLabelMaxChars'
					},
					{
						label: `Row Label Max Length`,
						title: `Truncate the row label if it exceeds this maximum number of characters`,
						type: 'number',
						chartType: 'matrix',
						settingsKey: 'rowlabelmaxchars'
					}
				],
				customInputs: this.appendDictInputs
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setDimensionsBtn(s) {
		const l = s.controlLabels
		this.opts.holder
			.append('button')
			.datum({
				label: 'Cell Layout',
				tables: [
					{
						rows: [
							{
								label: 'Grid',
								title:
									'Show grid lines, which creates borders around each matrix cells. ' +
									' Note that grid lines are hidden when the auto-computed width <= 2, or when either the column and row spacing is set to 0.',
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
								label: 'Outline Color',
								title: 'Set a border color for the whole matrix',
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'outlineStroke',
								colspan: 2,
								align: 'center'
								//getDisplayStyle: plot => this.parent.settings.matrix.showGrid ? '' : 'none'
							},
							{
								label: 'Beam Color',
								title: 'Set a color for the beam highlighter',
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'beamStroke',
								colspan: 2,
								align: 'center'
								//getDisplayStyle: plot => this.parent.settings.matrix.showGrid ? '' : 'none'
							},
							{
								label: 'Grid Line Color',
								title: 'Set the grid color, equivalent to applying the same border color for each matrix cell',
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'gridStroke',
								colspan: 2,
								align: 'center'
								//getDisplayStyle: plot => this.parent.settings.matrix.showGrid ? '' : 'none'
							},
							{
								label: 'Background Color',
								title: `Set the background color when there are no alterations or annotation data for a ${l.sample}`,
								type: 'color',
								chartType: 'matrix',
								settingsKey: 'cellbg',
								colspan: 2,
								align: 'center'
							},
							{
								label: `Use Canvas If # ${l.sample} Exceeds`,
								title: `Switch from SVG to canvas rendering when the number of ${l.samples} exceeds this number`,
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
								label: 'Canvas Min. Pixel Width',
								title:
									'Set a minimum pixel width for a matrix cell when using canvas, may affect the perceived sharpness of the canvas image',
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
								label: 'Row Height',
								title: 'Set the height of a matrix row',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [{ label: 'N/A' }, { settingsKey: 'rowh', min: 8, max: 30, step: 1 }]
							},
							{
								label: 'Min Col. Width',
								title: 'Set the minimum width of the auto-computed matrix column width',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [{ settingsKey: 'colwMin', min: 0.1, max: 16, step: 0.2 }, { label: 'N/A' }]
							},
							{
								label: 'Max Col. Width',
								title: 'Set the maximum width of the auto-computed matrix column width',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [{ settingsKey: 'colwMax', min: 1, max: 24, step: 0.2 }, { label: 'N/A' }]
							},
							{
								label: 'Spacing',
								title: 'Set the column spacing. Note that this will be set to 0 when the auto-computed width < 2.',
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
								title: 'Set the spacing between column and row groups.',
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
								title: 'Set the gap between the label text and matrix edge',
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
								title: 'Set the gap between labels',
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
								label: 'Minimum Size',
								title:
									'Set the minimum auto-computed font size for labels. Note that labels will be hidden if the auto-computed values falls below this minimum.',
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
								label: 'Maximum Size',
								title: 'Set the maximum auto-computed font size for labels',
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
								label: 'Group label<br/>position',
								title: 'Set which side of the matrix to display group labels',
								type: 'radio',
								width: 50,
								chartType: 'matrix',
								labelDisplay: 'block',
								inputs: [
									{
										settingsKey: 'collabelpos',
										// switched since settings.collabelpos refers to the individual column label, not group
										options: [
											{ label: 'Top', value: 'bottom', title: `Display ${l.sample} group labels at the bottom` },
											{ label: 'Bottom', value: 'top', title: `Display ${l.sample} group labels on top` }
										]
									},
									{
										settingsKey: 'rowlabelpos',
										// switched since settings.rowlabelpos refers to the individual column label, not group
										options: [
											{
												label: 'Left',
												value: 'right',
												title: `Display gene or variable group labels on the left side`
											},
											{
												label: 'Right',
												value: 'left',
												title: `Display gene or variable group labels on the right side`
											}
										]
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
				label: 'Legend Layout',
				rows: [
					//ontop: false,
					{
						label: 'Font Size',
						title: 'Set the font size for the legend text',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'fontsize'
					},
					{
						label: 'Line Height',
						title: 'Set the line height for a legend group',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'lineh'
					},
					{
						label: 'Icon Height',
						title: 'Set the icon height for a legend item',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'iconh'
					},
					{
						label: 'Icon Width',
						title: 'Set the icon width for a legend item',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'iconw'
					},
					/*{
						label: 'Bottom margin',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'padbtm'
					},*/
					{
						label: 'Item Left Pad',
						title: 'Set a left margin for each legend item',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'padx'
					},
					{
						label: 'Left Margin',
						title: 'Set a left margin for the whole legend',
						type: 'number',
						chartType: 'legend',
						settingsKey: 'padleft'
					},
					{
						label: 'Left Indent',
						title:
							`Set a left margin for the first legend item in each group, and should be set to the length of the longest group label.` +
							` The left indent will align the legend group label text to the right.`,
						type: 'number',
						chartType: 'legend',
						settingsKey: 'hangleft'
					},
					{
						label: 'Item Layout',
						title:
							'Option to separate each legend item into a new line, instead of a horizontal layout in the same line.',
						type: 'checkbox',
						chartType: 'legend',
						settingsKey: 'linesep',
						boxLabel: 'Line separated'
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
			.on('focus', () => this.parent.app.tip.hide())
			.on('click.sjpp-matrix-download', () => to_svg(this.opts.getSvg(), 'matrix', { apply_dom_styles: true }))
	}

	main() {
		this.parent.app.tip.hide()

		this.btns
			.text(d => (d.getCount ? `${d.getCount()} ` : '') + d.label)
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

		event.target.focus()
		app.tip.clear()

		const table = app.tip.d.append('form').append('table').attr('class', 'sjpp-controls-table')
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
				if (inputConfig.title) holder.attr('title', inputConfig.title)
				const input = await initByInput[inputConfig.type](
					Object.assign(
						{},
						{
							holder,
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

			table.selectAll('input, button, select').attr('tabindex', (d, i) => i + 1)

			// table.selectAll('td')
			// 	.attr('tabindex', (d,i) => i + 1)
		}

		table.selectAll('td').on('keyup.nav-handler', this.keyboardNavHandler)

		app.tip.showunder(event.target)
	}

	prependInfo(table, header, value) {
		const tr = table.append('tr')
		tr.append('td').text(header).attr('class', 'sja-termdb-config-row-label')
		tr.append('td').text(value)
	}

	async appendGeneInputs(self, app, parent, table) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = 0

		if (parent.opts.customInputs?.genes) {
			for (const inputConfig of parent.opts.customInputs?.genes) {
				inputConfig.chartType = 'matrix'
				const holder = table.append('tr')
				if (inputConfig.title) holder.attr('title', inputConfig.title)
				const input = await initByInput[inputConfig.type](
					Object.assign(
						{},
						{
							holder,
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
		const callback = (group, geneset) => {
			if (group.lst.length == 0)
				//it was a new group
				parent.config.termgroups.push(group)

			const lst = []
			for (const tw of group.lst) if (tw.term.type != 'geneVariant') lst.push(tw)
			const tws = geneset.map(d => {
				//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
				let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.name)
				if (!tw)
					tw = {
						$id: get$id(),
						term: {
							name: d.symbol || d.name,
							type: 'geneVariant'
						},
						q: {}
					}
				return tw
			})
			group.lst = lst
			// TODO: see above for input to select which group to add the gene
			// right not it assumes the first group
			group.lst.push(...tws)
			app.dispatch({
				type: 'plot_edit',
				id: parent.id,
				config: {
					termgroups: parent.config.termgroups
				}
			})
		}
		self.addGeneSearch(event, app, parent, table.append('tr'), callback)
		self.addGeneGroup(event, app, parent, table.append('tr'), callback)
	}

	appendDictInputs(self, app, parent, table) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = self.chartType == 'hierCluster' ? 1 : 0
		app.tip.d.append('hr')
		self.addDictMenu(app, parent, app.tip.d.append('div'))
	}

	addGeneSearch(event, app, parent, tr, callback) {
		const tg = parent.config.termgroups
		tr.append('td').attr('class', 'sja-termdb-config-row-label').html('Gene set')
		const td = tr.append('td')
		let select
		if (tg.length > 1) {
			select = td.append('select')
			select
				.selectAll('option')
				.data(tg)
				.enter()
				.append('option')
				.property('selected', (d, i) => tg.length < 2 || parent.selectedGroup === i)
				.attr('value', (d, i) => i)
				.html((d, i) => d.name || `Unlabeled group # ${i + 1}`)
		} else {
			const group = parent.config.termgroups[parent.selectedGroup]
			const count = group.lst.filter(tw => tw.term.type == 'geneVariant').length
			td.append('span')
				.style('color', '#aaa')
				.style('padding', '5px')
				.text(`${count} ${count == 1 ? 'gene' : 'genes'} `)
		}

		td.append('button')
			.style('margin-left', '3px')
			.text('Edit')
			.on('click', () => {
				const selectedGroup = parseInt(select?.node().value || 0)
				const group = parent.config.termgroups[selectedGroup]
				app.tip.clear().hide()

				const gsArg = {
					holder: event.target,
					menu: app.tip,
					genome: app.opts.genome,
					geneList: [],
					callback,
					vocabApi: this.opts.app.vocabApi,
					group,
					showGroup: parent.config.termgroups > 1
				}

				if (this.parent.chartType == 'hierCluster' && group == parent.hcTermGroup) {
					/* running hier clustering and the editing group is the group used for clustering
					pass this mode value to inform ui to support the optional button "top variably exp gene"
					this is hardcoded for the purpose of gene expression and should be improved
					*/
					gsArg.mode = 'expression'
				}

				for (const tw of group.lst) if (tw.term.type == 'geneVariant') gsArg.geneList.push({ name: tw.term.name })
				showGenesetEdit(gsArg)
			})
	}

	addGeneGroup(event, app, parent, tr, callback) {
		const tg = parent.config.termgroups
		parent.selectedGroup = 0
		tr.append('td').attr('class', 'sja-termdb-config-row-label')
		const td = tr.append('td')
		const input = td
			.append('input')
			.attr('placeholder', 'New group name')
			.on('input', function () {
				const name = input.node().value
				button.property('disabled', name == '')
			})
		const button = td
			.append('button')
			.text('Add new group')
			.property('disabled', true)
			.on('click', () => {
				const name = input.node().value
				const group = {
					name,
					overrides: false,
					lst: []
				}
				/* no need to detect the condition and assign mode=expression. 
				it is expected that a newly added gene term group will not trigger clustering analysis
				*/
				showGenesetEdit({
					holder: event.target,
					menu: app.tip,
					genome: app.opts.genome,
					geneList: [],
					callback,
					vocabApi: this.opts.app.vocabApi,
					group,
					showGroup: true
				})
			})
	}

	async addDictMenu(app, parent, tr, holder = undefined) {
		//app.tip.clear()

		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: holder || app.tip.d,
			vocabApi: this.parent.app.vocabApi,
			focus: 'off',
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
			},
			search: {
				focus: 'off'
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
			termgroups.push(grp)
			this.parent.app.dispatch({
				type: 'plot_edit',
				id: this.parent.id,
				config: { termgroups }
			})
		}
	}

	setZoomInput() {
		const holder = this.opts.holder.append('div').style('display', 'inline-block').style('margin-left', '50px')
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
