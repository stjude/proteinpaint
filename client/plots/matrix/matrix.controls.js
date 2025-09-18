import { initByInput } from '#plots/controls.config.js'
import { to_svg } from '#src/client'
import { getSorterUi } from './matrix.sorterUi'
import { fillTermWrapper, get$id } from '#termsetting'
import { Menu, zoom, icons, svgScroll, make_radios, make_one_checkbox, GeneSetEditUI } from '#dom'
import { select } from 'd3-selection'
import { mclass, dt2label, dtsnvindel, dtcnv, dtfusionrna, dtgeneexpression, dtsv } from '#shared/common.js'
import { TermTypes, TermTypeGroups, isNumericTerm } from '#shared/terms.js'

const tip = new Menu({ padding: '' })

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
		const l = s.controlLabels
		const controls = this
		const parent = this.parent
		const rows = [
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
				processInput: async tw => {
					if (tw?.term && isNumericTerm(tw.term)) {
						// any numeric term should be discrete when used as divideBy term
						// tw is missing when dividedBy term deleted
						tw.q = { ...tw.q, mode: 'discrete' }
					}
					if (tw) await fillTermWrapper(tw, this.opts.app.vocabApi)
					return tw
				},
				processConfig: config => {
					if (this.parent.chartType == 'hierCluster' && config['divideBy']) {
						config.settings = {
							hierCluster: {
								yDendrogramHeight: 0,
								clusterSamples: false
							}
						}
					}
					if (this.parent.config.divideBy)
						config.legendValueFilter = this.parent.mayRemoveTvsEntry(this.parent.config.divideBy)
				},
				getBodyParams: () => {
					// hierCluster hides the groupBy, so no need to consider gene expression term type
					const currentGeneNames = this.parent.termOrder
						.filter(t => t.tw.term.type === 'geneVariant')
						.map(t =>
							t.tw.term.chr ? `${t.tw.term.chr}:${t.tw.term.start}-${t.tw.term.stop}` : t.tw.term.gene || t.tw.term.name
						) // TODO term.gene replaces term.name
					if (currentGeneNames.length) return { currentGeneNames }
					return {}
				}
			}
		]

		rows.push({
			label: `Sort ${l.Sample} Priority`,
			title: `Set how to sort ${l.samples}`,
			type: 'custom',
			// the "input" argument is created by controls
			init(input) {
				const m = parent.config.settings.matrix
				if (!controls.activeTab) controls.activeTab = 'basic'
				input.dom.inputTd.style('padding', '5px')
				// **** !!! TODO: use dom/toggleButtons to create tabbed sections !!!
				const btnsDiv = input.dom.inputTd.append('div').style('margin-bottom', '5px')
				const basicBtn = btnsDiv
					.append('div')
					.style('display', 'inline-block')
					.style('padding-right', '5px')
					.style('border-right', '2px solid black')
					.style('text-decoration', controls.activeTab == 'basic' ? 'underline' : '')
					.style('cursor', 'pointer')
					.html('Basic')
					.on('click', () => {
						controls.activeTab = 'basic'
						basicBtn.style('text-decoration', 'underline')
						advancedBtn.style('text-decoration', '')
						basicDiv.style('display', '')
						advancedDiv.style('display', 'none')
					})
				const advancedBtn = btnsDiv
					.append('div')
					.style('display', 'inline-block')
					.style('margin-left', '5px')
					.style('text-decoration', controls.activeTab == 'advanced' ? 'underline' : '')
					.style('cursor', 'pointer')
					.html('Advanced')
					.on('click', () => {
						controls.activeTab = 'advanced'
						basicBtn.style('text-decoration', '')
						advancedBtn.style('text-decoration', 'underline')
						basicDiv.style('display', 'none')
						advancedDiv.style('display', '')
					})

				const basicDiv = input.dom.inputTd.append('div').style('display', controls.activeTab == 'basic' ? '' : 'none')
				const ssmDiv = basicDiv.append('div')
				ssmDiv.append('span').html('SSM')
				const { inputs } = make_radios({
					// holder, options, callback, styles
					holder: ssmDiv.append('span'),
					options: [
						{ label: 'by consequence', value: 'consequence', checked: m.sortByMutation === 'consequence' },
						{ label: 'by presence', value: 'presence', checked: m.sortByMutation === 'presence' }
					],
					styles: {
						display: 'inline-block'
					},
					callback: sortByMutation => {
						const sortOptions = parent.config.settings.matrix.sortOptions
						const activeOption = sortOptions.a
						const mutTb = activeOption.sortPriority[0].tiebreakers[1]
						mutTb.disabled = !sortByMutation
						mutTb.isOrdered = sortByMutation === 'consequence'

						parent.app.dispatch({
							type: 'plot_edit',
							id: parent.id,
							config: {
								settings: {
									matrix: {
										sortByMutation, // needed to show the correct status for checkbox, but actual sorting behavior
										sortOptions // is based on sortOptions.a[*].tiebreaker[*][disabled, isOrdered]
									}
								}
							}
						})
					}
				})

				inputs.style('margin', '2px 0 0 2px').style('vertical-align', 'top')
				const cnvDiv = basicDiv
					.append('div')
					.style('display', m.showMatrixCNV != 'none' && !m.allMatrixCNVHidden ? 'block' : 'none')

				cnvDiv.append('span').html('CNV')
				// holder, labeltext, callback, checked, divstyle
				const checkbox = make_one_checkbox({
					holder: cnvDiv.append('span'),
					divstyle: { display: 'inline-block' },
					checked: m.sortByCNV,
					labeltext: 'sort by CNV',
					callback: () => {
						const sortByCNV = checkbox.property('checked')
						const sortOptions = parent.config.settings.matrix.sortOptions
						const activeOption = sortOptions.a
						const cnvTb = activeOption.sortPriority[0].tiebreakers[2]
						cnvTb.disabled = !sortByCNV
						cnvTb.isOrdered = sortByCNV

						parent.app.dispatch({
							type: 'plot_edit',
							id: parent.id,
							config: {
								settings: {
									matrix: {
										sortByCNV, // needed to show the correct status for checkbox, but actual sorting behavior
										sortOptions // is based on sortOptions.a[*].tiebreaker[*][disabled, isOrdered]
									}
								}
							}
						})
					}
				})

				const advancedDiv = input.dom.inputTd
					.append('div')
					.style('display', controls.activeTab == 'advanced' ? '' : 'none')
				input.dom.row.on('mouseover', function () {
					this.style.backgroundColor = '#fff'
					this.style.textShadow = 'none'
				})

				if (!controls.sorterUi) {
					controls.sorterUi = getSorterUi({
						controls: this,
						holder: advancedDiv,
						tip: this.parent.app.tip
					})
				} else {
					controls.sorterUi.main(this.parent.config.settings.matrix, { holder: advancedDiv })
				}

				return {
					main: plot => {
						const s = plot.settings.matrix
						// ssm
						inputs.property('checked', d => d.value == s.sortByMutation)
						// cnv
						checkbox.property('checked', s.sortByCNV)
						cnvDiv.style('display', s.showMatrixCNV != 'none' && !s.allMatrixCNVHidden ? 'block' : 'none')
					}
				}
			}
		})

		this.opts.holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: l.Samples || `Samples`,
				getCount: () =>
					'sampleCount' in this.overrides ? this.overrides.sampleCount : this.parent.sampleOrder?.length || 0,
				rows,
				customInputs: this.updateSamplesControls
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	setGenesBtn(s) {
		const l = s.controlLabels
		const renderStyleOptions = [
			{
				label: `&nbsp;Stacked <span style="font-size:.7em;color:#555;">Show stacked rectangles in the same matrix cell to render variants for the same ${l.sample} and gene</span>`,
				value: '',
				title: `Show stacked rectangles in the same matrix cell to render variants for the same ${l.sample} and gene`
			},
			{
				label: `&nbsp;OncoPrint <span style="font-size:.7em;color:#555;">Show overlapping rectangles in the same matrix cell to render variants for the same ${l.sample} and gene</span>`,
				value: 'oncoprint',
				title: `Show overlapping rectangles in the same matrix cell to render variants for the same ${l.sample} and gene`
			}
		]
		if (s.addMutationCNVButtons && this.parent.chartType !== 'hierCluster')
			renderStyleOptions.unshift({
				label: `&nbsp;Single <span style="font-size:.7em;color:#555;">Show a single rectangle in a matrix cell to render the most severe variant (truncating > indels > missense > synonymous) for the same ${l.sample} and gene</span>`,
				value: 'single',
				title: `Show a single rectangle in a matrix cell to render the most severe variant (truncating > indels > missense > synonymous) for the same ${l.sample} and gene`
			})
		this.opts.holder
			.append('button')
			//.property('disabled', d => d.disabled)
			.datum({
				label: 'Genes',
				getCount: () =>
					this.parent.termOrder?.filter(
						t => t.tw.term.type == TermTypes.GENE_VARIANT || t.tw.term.type == TermTypes.GENE_EXPRESSION
					).length || 0,
				customInputs: this.addGeneInputs,
				rows: [
					{
						label: `Display ${l.Sample} Counts for Gene`,
						title: `Include the ${l.sample} count in the gene label`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'samplecount4gene',
						styles: { display: 'inline-block' },
						options: [
							{ label: 'Absolute', value: 'abs' },
							{ label: `Percent`, value: 'pct' },
							{ label: `None`, value: '' }
						],
						getDisplayStyle(plot) {
							return this.parent.termOrder?.filter(t => t.tw.term.type == 'geneVariant').length ? 'table-row' : 'none'
						}
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
						label: 'Genomic Alterations Rendering',
						title: `Set how to indicate a ${l.sample}'s applicable variant types in the same matrix cell`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'cellEncoding',
						options: renderStyleOptions,
						styles: { padding: '5px 0px', margin: 0 },
						labelDisplay: 'block',
						getDisplayStyle(plot) {
							return this.parent.termOrder?.filter(t => t.tw.term.type == 'geneVariant').length ? 'table-row' : 'none'
						},
						callback: this.parent.geneStyleControlCallback
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
						styles: { padding: 0, 'padding-right': '10px', margin: 0, display: 'inline-block' },
						getDisplayStyle(plot) {
							return this.parent.termOrder?.filter(t => t.tw.term.type == 'geneVariant').length ? 'table-row' : 'none'
						}
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
								inputs: [{ label: 'N/A' }, { settingsKey: 'rowh', min: 8, max: 30, step: 1 }],
								getDisplayStyle(plot) {
									return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
								}
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
								],
								getDisplayStyle(plot) {
									return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
								}
							},
							{
								label: 'Group spacing',
								title: 'Set the spacing between column and row groups.',
								type: 'number',
								width: 50,
								align: 'center',
								chartType: 'matrix',
								inputs: [
									this.parent.chartType == 'hierCluster'
										? { label: 'N/A' }
										: { settingsKey: 'colgspace', min: 0, max: 20, step: 1 },
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
								label: 'Min font size',
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
								label: 'Max font size',
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
								getDisplayStyle(plot) {
									return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
								},
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

	// Mutation button for selecting mutations to display on the matrix
	setMutationBtn() {
		this.opts.holder
			.append('button')
			.style('margin', '2px 0')
			.datum({
				label: 'Mutation',
				updateBtn: btn => {
					const s = this.parent.config.settings.matrix
					btn
						.style('text-decoration', s.allMatrixMutationHidden ? 'line-through' : '')
						.style('text-decoration-thickness', s.allMatrixMutationHidden ? '2px' : '')
				},
				rows: [
					{
						title: `Show mutation options`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'showMatrixMutation',
						options: [
							{ label: 'Show all mutations', value: 'all' },
							{ label: `Show only truncating mutations`, value: 'onlyTruncating' },
							{ label: `Show only protein-changing mutations`, value: 'onlyPC' },
							{ label: `Do not show mutations`, value: 'none' },
							{ label: `Show selected mutation`, value: 'bySelection' }
						],
						labelDisplay: 'block',
						getDisplayStyle(plot) {
							return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
						},
						callback: this.parent.mutationControlCallback
					}
				],
				customInputs: this.generateMutationItems
			})
			.html(d => d.label)
			.style('margin', '2px 0')
			.on('click', (event, d) => this.callback(event, d))
	}

	// CNV button for selecting the CNVs to display on the matrix
	setCNVBtn() {
		this.opts.holder
			.append('button')
			.style('margin', '2px 0')
			.datum({
				label: 'CNV',
				updateBtn: btn => {
					const s = this.parent.config.settings.matrix
					const notRendered = s.allMatrixCNVHidden
					btn
						.style('text-decoration', notRendered ? 'line-through' : '')
						.style('text-decoration-thickness', notRendered ? '2px' : '')
				},
				rows: [
					{
						title: `Show CNV options`,
						type: 'radio',
						chartType: 'matrix',
						settingsKey: 'showMatrixCNV',
						options: [
							{ label: 'Show all CNV', value: 'all' },
							{ label: `Do not show CNV`, value: 'none' },
							{ label: `Show selected CNV`, value: 'bySelection' }
						],
						labelDisplay: 'block',
						getDisplayStyle(plot) {
							return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
						},
						callback: this.parent.CNVControlCallback
					}
				],
				customInputs: this.generateCNVItems
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
			.on('click.sjpp-matrix-download', event => {
				const p = this.parent
				if (!p.dom.downloadMenu) p.dom.downloadMenu = new Menu({ padding: '' })
				const downloadMenu = p.dom.downloadMenu.clear()
				const div = downloadMenu.d.append('div')
				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(`SVG image`)
					.on('click.sjpp-matrix-download', () => {
						to_svg(this.opts.getSvg(), 'matrix', { apply_dom_styles: true })
						p.dom.downloadMenu.destroy()
					})

				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(`TSV data`)
					.on('click.sjpp-matrix-download', () => {
						const lst = p.data.lst
						const allTerms = p.termOrder.map(t => t.tw)
						const assayAvailability = p.state.termdbConfig.assayAvailability
						const controlLabels = p.settings.matrix.controlLabels
						if (p.config.divideBy?.id && !allTerms.find(a => a.id == p.config.divideBy.id)) {
							// when divideBy term is not in the matrix terms
							allTerms.push(p.config.divideBy)
						}

						const activeSamples = []
						for (const d of lst) {
							for (const tw of allTerms) {
								if (tw.$id in d) {
									activeSamples.push(d)
									break
								}
							}
						}

						const header = [controlLabels.Sample]
						for (const tw of allTerms) header.push(tw.term.name)

						const rows = [header]
						for (const s of activeSamples) {
							const row = [s._ref_.label]
							for (const tw of allTerms) {
								if (!s[tw.$id]) {
									row.push('')
								} else {
									if (tw.term.type == 'geneVariant') {
										const allVariant = []
										for (const v of s[tw.$id].renderedValues) {
											// when assayAvailability presents, has WT and Blank
											const hasAssayAvailability = assayAvailability?.byDt?.[parseInt(v.dt)]
											if (v.dt == dtsnvindel) {
												allVariant.push(
													(v.origin ? `${v.origin} ` : '') +
														(hasAssayAvailability ? `${dt2label[v.dt]}:` : '') +
														`${mclass[v.class]?.label}` +
														(v.mname ? `,${v.mname}` : '')
												)
											} else if (v.dt == dtcnv) {
												const cnvValue = v.value
													? `${hasAssayAvailability ? '' : 'CNV:'}${v.value}` //show v.value for numerical CNV, otherwise show CNV gain/loss
													: v.class == 'CNV_amp'
													? 'CNV gain'
													: v.class == 'CNV_loss'
													? 'CNV loss'
													: v.class == 'CNV_homozygous_deletion'
													? 'CNV homozygous deletion'
													: v.class == 'CNV_amplification'
													? 'CNV amplification'
													: v.class == 'CNV_loh'
													? 'CNV loss of heterozygosity'
													: mclass[v.class]?.label

												allVariant.push(
													(v.origin ? `${v.origin} ` : '') +
														(hasAssayAvailability ? `${dt2label[v.dt]}:` : '') +
														cnvValue
												)
											} else if (v.dt == dtfusionrna || v.dt == dtsv) {
												allVariant.push(
													(v.origin ? `${v.origin} ` : '') +
														(hasAssayAvailability ? `${dt2label[v.dt]}:` : '') +
														`${mclass[v.class]?.label}` +
														(v.gene && v.mname ? `(${v.gene}::${v.mname})` : '')
												)
											} else {
												allVariant.push(`DO NOT SUPPORT dt='${v.dt}'`)
											}
										}
										row.push(allVariant.join('|'))
									} else if (
										tw.term.type == TermTypes.GENE_EXPRESSION ||
										tw.term.type == TermTypes.METABOLITE_INTENSITY
									) {
										row.push(s[tw.$id]?.renderedValues?.[0]?.value || '')
									} else {
										row.push(s[tw.$id]?.renderedValues?.[0] || s[tw.$id]?.value || '')
									}
								}
							}
							rows.push(row)
						}

						const matrix = rows.map(row => row.join('\t')).join('\n')
						const a = document.createElement('a')
						document.body.appendChild(a)
						a.addEventListener(
							'click',
							function () {
								const currentDate = new Date().toISOString().split('T')[0]
								a.download = p.config.settings?.hierCluster?.termGroupName?.startsWith('Gene Expression')
									? `GeneExpression.${currentDate}.tsv`
									: p.chartType == 'hierCluster'
									? `HierCluster.${currentDate}.tsv`
									: `${p.app.vocabApi.termdbConfig.matrix?.appName || 'Matrix'}.${currentDate}.tsv`
								a.href = URL.createObjectURL(new Blob([matrix], { type: 'text/tab-separated-values' }))
								document.body.removeChild(a)
							},
							false
						)
						a.click()
						p.dom.downloadMenu.destroy()
					})
				downloadMenu.showunder(event.target)
			})
	}

	main(overrides = {}) {
		this.overrides = overrides
		this.parent.app.tip.hide()

		this.btns
			.text(d => (d.getCount ? `${d.getCount()} ` : '') + d.label)
			.each(function (d) {
				if (d.updateBtn) d.updateBtn(select(this))
			})

		const s = this.parent.settings.matrix || this.parent.config.settings.matrix
		const min = s.colwMin / s.colw
		const max = s.colwMax / s.colw
		const increment = Math.max(0.01, Number((min / max).toFixed(2)))

		const d = this.parent.dimensions
		if (this.zoomApi)
			this.zoomApi.update({
				value: s.zoomLevel.toFixed(2),
				min,
				max,
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
		if (parent.chartType == 'hierCluster' && parent.config.dataType == TermTypes.GENE_EXPRESSION) {
			self.appendGeneInputs(self, app, parent, table, 'hierCluster')
		}
		if (
			parent.state?.termdbConfig?.allowedTermTypes?.includes(TermTypes.GENE_VARIANT) ||
			parent.state.termdbConfig.queries.snvindel
		)
			self.appendGeneInputs(self, app, parent, table)
	}
	async appendGeneInputs(self, app, parent, table, geneInputType) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = 0

		if (parent.opts.customInputs?.genes) {
			// these are embedder portal specific controls
			for (const inputConfig of parent.opts.customInputs.genes) {
				inputConfig.chartType = 'matrix'
				const holder = table.append('tr')
				if (inputConfig.title) holder.attr('aria-label', inputConfig.title)
				const input = await initByInput[inputConfig.type](
					Object.assign(
						{},
						{
							holder,
							app,
							id: parent.id,
							debug: self.opts.debug,
							parent
						},
						inputConfig
					)
				)
				input.main(parent.config)
			}
		}
		let geneInputTr
		if (geneInputType == 'hierCluster' || parent.chartType !== 'hierCluster') {
			// Insert the gene set edit UI at the top
			geneInputTr = table.insert('tr', () => table.select('tr').node())
		} else {
			// Insert after first gene set edit UI
			const secondTr = table.selectAll('tr').nodes()[1] || null
			// Add visual separator: <hr> row
			const hrTr = table.insert('tr', () => secondTr)
			hrTr.append('td').attr('colspan', 2).append('hr').style('border', '1px solid #ccc')
			geneInputTr = table.insert('tr', () => secondTr)
		}
		self.addGenesetInput(app, parent, geneInputTr, geneInputType)
	}

	addGenesetInput(app, parent, tr, geneInputType) {
		const controlPanelBtn = this.btns.filter(d => d.label.endsWith('Genes'))?.node()
		const tip = app.tip //new Menu({ padding: '5px' })
		const tg = parent.config.termgroups

		let selectedGroup
		const triggerGenesetEdit = holder => {
			holder.selectAll('*').remove()
			const geneList = selectedGroup.lst.map(item => {
				return { gene: item.name }
			}) //To do, selectedGroup.lst may replace name with gene as well
			new GeneSetEditUI({
				holder,
				genome: app.opts.genome,
				geneList,
				// Remove the GFF Loads Gene Sets option from unclustered genes panel.
				customInputs:
					parent.chartType !== 'hierCluster' || geneInputType == 'hierCluster'
						? this.parent.opts.customInputs?.geneset
						: undefined,
				/* running hier clustering and the editing group is the group used for clustering
				pass this mode value to inform ui to support the optional button "top variably exp gene"
				this is hardcoded for the purpose of gene expression and should be improved
				*/

				mode: selectedGroup.mode,
				minNumGenes: selectedGroup.mode == 'geneExpression' ? 3 : 1,
				vocabApi: this.opts.app.vocabApi,
				callback: async ({ geneList, groupName }) => {
					if (!selectedGroup) throw `missing selectedGroup`
					tip.hide()
					const group = selectedGroup.status == 'new' ? { name: groupName, lst: [] } : tg[selectedGroup.index]
					if (selectedGroup.status == 'new') tg.push(group)
					const targetTermType = selectedGroup.mode == 'geneExpression' ? 'geneExpression' : 'geneVariant'
					// remove gene terms to be replaced by the new lst, keep all other term types in the group
					const lst = group.lst.filter(tw => tw.term.type != targetTermType)
					const tws = await Promise.all(
						geneList.map(async d => {
							let term
							if (targetTermType == 'geneExpression') {
								const gene = d.symbol || d.gene
								const unit = app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
								const name = `${gene} ${unit}`
								term = { gene, name, type: 'geneExpression' }
							} else {
								term = {
									gene: d.symbol || d.gene,
									name: d.symbol || d.gene,
									type: 'geneVariant'
								}
							}
							//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
							let tw = group.lst.find(
								tw => (tw.term.gene == d.symbol || tw.term.gene == d.gene) && tw.term.type == targetTermType
							)
							if (!tw) {
								tw = { term }
								await fillTermWrapper(tw, this.opts.app.vocabApi)
							} else if (!tw.$id) {
								tw.$id = await get$id(this.opts.app.vocabApi.getTwMinCopy({ term }))
							}
							return tw
						})
					)
					group.lst = [...lst, ...tws]
					if (!group.lst.length) tg.splice(selectedGroup.index, 1)
					app.dispatch({
						type: 'plot_edit',
						id: this.parent.id,
						config: {
							termgroups: tg
						}
					})
				},
				backBtn: {
					target: 'Genes Menu',
					callback: () => {
						controlPanelBtn.click()
					}
				},
				termsAsListed:
					(geneInputType == 'hierCluster' && !this.parent.config.settings.hierCluster.clusterRows) ||
					(geneInputType != 'hierCluster' && this.parent.config.settings.matrix.sortTermsBy == 'asListed')
			})
		}

		//the number of groups in the current matrix that is editable: hiercluster group should not be edited from "Genes" control panel.
		const numOfEditableGrps = tg.filter(g => g.type != 'hierCluster').length

		tr.append('td')
			.attr('class', 'sja-termdb-config-row-label')
			.html(geneInputType == 'hierCluster' ? 'Hierarchical Clustering Gene Set' : 'Genomic Alteration Gene Set')

		if (numOfEditableGrps > 0 || geneInputType == 'hierCluster') {
			const td1 = tr.append('td').style('display', 'block').style('padding', '5px 0px')
			const editGrpDiv = td1.append('div').append('label')

			const editBtn = editGrpDiv
				.append('button')
				.html(
					numOfEditableGrps > 1 && geneInputType !== 'hierCluster'
						? 'Edit Selected Group'
						: geneInputType == 'hierCluster'
						? 'Edit Gene Set'
						: 'Edit Current Group'
				)
				.on('click', () => {
					tip.clear()
					this.setMenuBackBtn(tip.d.append('div').style('padding', '5px'), () => controlPanelBtn.click(), `Back`)
					const genesetEdiUiHolder = tip.d.append('div')
					triggerGenesetEdit(genesetEdiUiHolder)
				})

			if (numOfEditableGrps > 1 && geneInputType !== 'hierCluster') {
				const { nonHierClusterGroups, groupSelect } = this.setTermGroupSelector(editGrpDiv, tg)
				selectedGroup = nonHierClusterGroups.find(g => g.selected)
				groupSelect.on('change', () => {
					selectedGroup = nonHierClusterGroups[groupSelect.property('value')]
				})
			} else {
				const s = parent.config.settings.hierCluster
				const g =
					geneInputType == 'hierCluster' ? tg.find(g => g.type == 'hierCluster') : tg.find(g => g.type != 'hierCluster')

				selectedGroup = {
					index:
						geneInputType == 'hierCluster' ? tg.findIndex(g => g.type == 'hierCluster') : tg[0].type == g.type ? 0 : 1,
					name: g.name,
					type: g.type,
					lst:
						g.type == 'hierCluster'
							? g.lst.map(tw => ({ name: tw.term.gene || tw.term.name }))
							: g.lst.filter(tw => tw.term.type == TermTypes.GENE_VARIANT).map(tw => ({ name: tw.term.name })),
					mode:
						g.type == 'hierCluster'
							? s.dataType // is clustering group, pass dataType
							: // !!subject to change!! when group is not clustering, and ds has mutation, defaults to MUTATION_CNV_FUSION
							this.parent.state.termdbConfig.queries?.snvindel
							? TermTypes.GENE_VARIANT
							: '',
					selected: true
				}
			}
		}

		if (geneInputType == 'hierCluster') {
			// Gene set edit UI under "Clustering" control panel doen't need "create New Group"
			return
		}
		const td2 = tr.append('td').style('display', 'block').style('padding', '5px 0px')
		const createNewGrpDiv = td2.append('div').append('label')

		const createBtn = createNewGrpDiv
			.append('button')
			.html('Create New Group')
			.property('disabled', true)
			.on('click', () => {
				tip.clear()
				this.setMenuBackBtn(tip.d.append('div'), () => controlPanelBtn.click(), 'Back')
				const name = nameInput.property('value')
				const s = parent.config.settings.hierCluster
				selectedGroup = {
					index: tg.length,
					name,
					label: name,
					lst: [],
					status: 'new',
					mode: parent.state.termdbConfig.queries?.snvindel ? TermTypes.GENE_VARIANT : ''
				}
				triggerGenesetEdit(tip.d.append('div'))
			})

		const nameInput = createNewGrpDiv
			.append('input')
			.style('margin', '2px 5px')
			.style('width', '210px')
			.attr('placeholder', 'Group Name')
			.on('input', () => {
				createBtn.property('disabled', !nameInput.property('value'))
			})
			.on('keyup', event => {
				if (event.key == 'Enter' && !createBtn.property('disabled')) {
					createBtn.node().click()
				}
			})

		// if (parent.opts.customInputs?.geneset) {
		// 	for (const btn of parent.opts.customInputs.geneset) {
		// 		td.append('button')
		// 			.html(btn.label)
		// 			.on('click', () => {
		// 				tip.hide()
		// 				btn.showInput({
		// 					callback: genesArr => {
		// 						const geneLst = genesArr.map(gene => ({ gene }))
		// 						// TODO: this may not be the first term group
		// 						let group = tg.find(g => g.lst.find(tw => tw.term?.type == 'geneVariant'))
		// 						if (!group) group = tg[0]
		// 						const lst = group.lst.filter(tw => tw.term.type != 'geneVariant')
		// 						const tws = geneLst.map(d => {
		// 							//if it was present use the previous term, genomic range terms require chr, start and stop fields, found in the original term
		// 							let tw = group.lst.find(tw => tw.term.name == d.symbol || tw.term.name == d.gene)
		// 							if (!tw)
		// 								tw = {
		// 									$id: get$id(),
		// 									term: {
		// 										name: d.symbol || d.gene,
		// 										type: 'geneVariant'
		// 									},
		// 									q: {}
		// 								}
		// 							return tw
		// 						})
		// 						group.lst = [...lst, ...tws]
		// 						if (!group.lst.length) tg.splice(selectedGroup.index, 1)
		// 						app.dispatch({
		// 							type: 'plot_edit',
		// 							id: this.parent.id,
		// 							config: {
		// 								termgroups: tg
		// 							}
		// 						})
		// 					}
		// 				})
		// 			})
		// 	}
		// }
	}

	setMenuBackBtn(holder, callback, label) {
		holder
			.attr('tabindex', 0)
			.style('padding', '5px')
			.style('text-decoration', 'underline')
			.style('cursor', 'pointer')
			.style('margin-bottom', '12px')
			.html(`&#171; ${label}`)
			.on('click', callback)
			.on('keyup', event => {
				if (event.key == 'Enter') event.target.click()
			})
	}

	setTermGroupSelector(holder, tg) {
		//const label = grpDiv.append('label')
		//label.append('span').html('')
		const firstGrpWithGeneTw = tg.find(g =>
			g.lst.find(tw => tw.term.type == TermTypes.GENE_VARIANT && g.type !== 'hierCluster')
		)
		const groups = tg.map((g, index) => {
			return {
				index,
				name: g.name,
				type: g.type,
				lst: g.lst.filter(tw => tw.term.type == TermTypes.GENE_VARIANT).map(tw => ({ name: tw.term.name })),
				mode: this.parent.state.termdbConfig.queries?.snvindel ? TermTypes.GENE_VARIANT : '',
				selected: g === firstGrpWithGeneTw
			}
		})
		const nonHierClusterGroups = groups.filter(g => g.type != 'hierCluster')

		const groupSelect = holder.append('select').style('width', '218px').style('margin', '2px 5px')
		for (const [i, group] of nonHierClusterGroups.entries()) {
			if (group.label) continue
			if (group.name) group.label = group.name
			else group.label = `Unlabeled group #${i + 1}` // cannot assume "gene" group
		}

		groupSelect
			.selectAll('option')
			.data(nonHierClusterGroups)
			.enter()
			.append('option')
			.property('selected', grp => grp.selected)
			.attr('value', (d, i) => i)
			.html(grp => grp.label)

		return { nonHierClusterGroups, groupSelect }
	}

	appendDictInputs(self, app, parent, table) {
		tip.clear()
		if (!parent.selectedGroup) parent.selectedGroup = self.chartType == 'hierCluster' ? 1 : 0
		app.tip.d.append('hr')
		self.addDictMenu(app, parent, app.tip.d.append('div'))
	}

	generateCNVItems(self, app, parent, table) {
		table.attr('class', null) // remove the hoverover background for CNV button
		const m = parent.config.settings.matrix
		const mutationLegendGrp = parent.legendData.find(l => l.dt?.includes(dtsnvindel))
		if (
			m.showMatrixCNV !== 'none' &&
			(m.allMatrixMutationHidden ||
				!mutationLegendGrp ||
				mutationLegendGrp.crossedOut ||
				!mutationLegendGrp.items.find(i => !i.greyedOut && !i.crossedOut))
		) {
			// when all mutation items in the current matrix are hidden or there is no mutation data
			table.select("input[type='radio'][value='none']").property('disabled', true)

			table.select("input[type='radio'][value='none'] + span").style('opacity', '0.5').on('mouseup', null)
		}
		if (m.addMutationCNVButtons && parent.chartType !== 'hierCluster' && m.showMatrixCNV == 'bySelection')
			parent.CNVControlCallback('bySelection')
	}

	generateMutationItems(self, app, parent, table) {
		table.attr('class', null) // remove the hoverover background for CNV button
		const m = parent.config.settings.matrix
		const cnvLegendGrp = parent.legendData.find(l => l.dt?.includes(dtcnv))
		if (
			m.showMatrixMutation !== 'none' &&
			(m.allMatrixCNVHidden ||
				!cnvLegendGrp ||
				cnvLegendGrp.crossedOut ||
				!cnvLegendGrp.items.find(i => !i.greyedOut && !i.crossedOut))
		) {
			// when all CNV items in the current matrix are hidden or there is no CNV data
			table.select("input[type='radio'][value='none']").property('disabled', true)

			table.select("input[type='radio'][value='none'] + span").style('opacity', '0.5').on('mouseup', null)
		}
		if (m.addMutationCNVButtons && parent.chartType !== 'hierCluster' && m.showMatrixMutation == 'bySelection')
			parent.mutationControlCallback('bySelection')
	}
	updateSamplesControls(self, app, parent, table) {
		if (parent.chartType == 'hierCluster' && parent.config.settings.hierCluster.clusterSamples) {
			const l = parent.config.settings.matrix.controlLabels
			const sortingControl = select(
				table
					.selectAll('td')
					.filter(function () {
						return select(this).text() == `Sort ${l.Sample} Priority`
					})
					.node()
					.closest('tr')
			)
			sortingControl.style('display', 'none')
		}
	}

	async addDictMenu(app, parent, tr, holder = undefined) {
		//app.tip.clear()

		const termdb = await import('#termdb/app')
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
				await fillTermWrapper(tw, this.opts.app.vocabApi)
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
		const s = this.parent.settings.matrix || this.parent.config.settings.matrix
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
