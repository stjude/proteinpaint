import { getCompInit, copyMerge, type RxComponent } from '#rx'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { GRIN2Dom, GRIN2Opts } from './GRIN2Types'
import { dofetch3 } from '#common/dofetch'
import { Menu, renderTable, table2col, make_one_checkbox, sayerror } from '#dom'
import { dtsnvindel, dtsv, dtfusionrna, mclass, dtcnv } from '#shared/common.js'
import { get$id } from '#termsetting'
import { PlotBase } from '#plots/PlotBase.ts'
import { plotManhattan } from '#plots/manhattan/manhattan.ts'

class GRIN2 extends PlotBase implements RxComponent {
	readonly type = 'grin2'
	dom: GRIN2Dom
	private runButton!: any
	private dtUsage: Record<number, { checked: boolean; label: string }> = {}

	// Colors
	readonly borderColor = '#eee'
	readonly backgroundColor = '#f8f8f8'
	readonly optionsTextColor = '#666'
	readonly btnBackgroundColor = '#f0f0f0'
	readonly btnBorderColor = '#ccc'
	readonly btnTextColor = '#333'
	readonly btnHoverBackgroundColor = '#e0e0e0'
	readonly btnDisabledBackgroundColor = '#f8f8f8'
	readonly btnDisabledTextColor = '#999'

	// Typography
	readonly optionsTextFontSize: number = 12
	readonly btnFontSize: number = 12
	readonly headerFontSize: number = 14
	readonly headerFontWeight: number = 600
	readonly tableFontSize: number = 11

	// Spacing & Layout
	readonly btnPadding = '8px 16px'
	readonly btnSmallPadding = '2px 8px' // for Select All/Clear All
	readonly btnBorderRadius = '3px'
	readonly btnMargin = '10px'
	readonly tableCellPadding = '8px'
	readonly controlsMargin = '5px'
	readonly controlsPadding = '10px'

	// Input fields
	readonly inputWidth = '80px'
	readonly inputPadding = '2px 4px'
	readonly inputBorderColor = '#ddd'
	readonly inputBorderRadius = '2px'

	// Containers
	readonly checkboxContainerMaxHeight = '150px'
	readonly checkboxContainerBackground = '#fafafa'
	readonly checkboxContainerBorder = '1px solid #ddd'
	readonly checkboxContainerPadding = '4px'
	readonly checkboxContainerBorderRadius = '3px'

	// Interactive states
	readonly disabledOpacity = '0.6'
	readonly enabledOpacity = '1'

	// Gaps and offsets
	readonly controlGap = '8px'
	readonly checkboxMarginBottom = '2px'
	readonly headerMargin = '0 10px 0 0'
	readonly sectionMargin = '20px 0'

	constructor(opts: any, api) {
		super(opts, api)
		this.opts = opts
		const holder = opts.holder.classed('sjpp-grin2-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')

		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			tip: new Menu({ padding: '' }),
			geneTip: new Menu({ padding: '' })
		}

		if (opts.header) this.dom.header = opts.header.text('GRIN2').style('font-size', '0.7em').style('opacity', 0.6)
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termdbConfig: appState.termdbConfig,
			termfilter: appState.termfilter,
			config: Object.assign({}, config, {
				settings: {
					grin2: config.settings
				}
			})
		}
	}

	async setControls() {
		this.createConfigTable()
	}

	private hasFusion(): boolean {
		return this.app.vocabApi.termdbConfig.queries.svfusion.dtLst.includes(dtfusionrna)
	}
	private hasSv(): boolean {
		return this.app.vocabApi.termdbConfig.queries.svfusion.dtLst.includes(dtsv)
	}

	// Helper for making styling of data type cells consistent
	private addTd(tr: any) {
		const td = tr
			.append('td')
			.style('padding', this.tableCellPadding)
			.style('font-weight', '500')
			.style('font-size', `${this.optionsTextFontSize}px`)
			.style('vertical-align', 'top')
			.style('border-right', `1px solid ${this.borderColor}`)
			.style('border-bottom', `1px solid ${this.borderColor}`)
		return td
	}

	// Add SNV/INDEL row
	private addSnvindelRow = (table: any) => {
		const [left, right] = table.addRow()

		// Options table
		const snvindelTableOpts = table2col({ holder: right })

		// Top numeric options
		this.dom.snvindel_minTotalDepth = this.addOptionRowToTable(
			snvindelTableOpts,
			'Min Total Depth',
			10, // default
			0, // min
			1e6, // max
			1 // step
		)
		this.dom.snvindel_minAltAlleleCount = this.addOptionRowToTable(
			snvindelTableOpts,
			'Min Alt Allele Count',
			2,
			0,
			1e6,
			1
		)
		// 5' flanking size
		this.dom.snvindel_five_prime_flank_size = this.addOptionRowToTable(
			snvindelTableOpts,
			"5' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)
		// 3' flanking size
		this.dom.snvindel_three_prime_flank_size = this.addOptionRowToTable(
			snvindelTableOpts,
			"3' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		// Consequences section header + checkbox grid
		{
			const [labelCell, containerCell] = snvindelTableOpts.addRow()
			labelCell
				.text('Consequences')
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('font-weight', '600')
				.style('padding-top', '8px')

			// Build the consequence checkboxes in the right cell
			this.createConsequenceCheckboxes(containerCell)
		}

		// ----- Left-side SNV/INDEL checkbox -----
		const isChecked = this.dtUsage[dtsnvindel]?.checked ?? true
		right.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'SNV/INDEL (Mutation)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtsnvindel].checked = checked
				right.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Add CNV row
	private addCnvRow = (table: any) => {
		const [left, right] = table.addRow()

		// CNV options table
		const cnvTableOpts = table2col({ holder: right })

		// Loss Threshold
		this.dom.cnv_lossThreshold = this.addOptionRowToTable(
			cnvTableOpts,
			'Loss Threshold',
			-0.4, // default
			-5, // min
			0, // max
			0.05 // step
		)

		// Gain Threshold
		this.dom.cnv_gainThreshold = this.addOptionRowToTable(
			cnvTableOpts,
			'Gain Threshold',
			0.3, // default
			0, // min
			5, // max
			0.05 // step
		)

		// Max Segment Length (0 = no cap)
		this.dom.cnv_maxSegLength = this.addOptionRowToTable(
			cnvTableOpts,
			'Max Segment Length',
			0, // default (no cap)
			0, // min
			1e9, // max
			1000 // step
		)

		// 5' flanking size
		this.dom.cnv_five_prime_flank_size = this.addOptionRowToTable(
			cnvTableOpts,
			"5' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		// 3' flanking size
		this.dom.cnv_three_prime_flank_size = this.addOptionRowToTable(
			cnvTableOpts,
			"3' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		// ----- Left-side CNV checkbox -----
		const isChecked = this.dtUsage[dtcnv]?.checked ?? true
		right.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'CNV (Copy Number Variation)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtcnv].checked = checked
				right.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Add Fusion row
	private addFusionRow = (table: any) => {
		const [left, right] = table.addRow()

		// Fusion options table
		const fusionTableOpts = table2col({ holder: right })

		// 5' flanking size
		this.dom.fusion_five_prime_flank_size = this.addOptionRowToTable(
			fusionTableOpts,
			"5' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		// 3' flanking size
		this.dom.fusion_three_prime_flank_size = this.addOptionRowToTable(
			fusionTableOpts,
			"3' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		const isChecked = this.dtUsage[dtfusionrna]?.checked ?? false
		right.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'Fusion (RNA Fusion Events)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtfusionrna].checked = checked
				right.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Add SV row
	private addSvRow = (table: any) => {
		const [left, right] = table.addRow()

		// SV options table
		const svTableOpts = table2col({ holder: right })

		// 5' flanking size
		this.dom.sv_five_prime_flank_size = this.addOptionRowToTable(
			svTableOpts,
			"5' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		// 3' flanking size
		this.dom.sv_three_prime_flank_size = this.addOptionRowToTable(
			svTableOpts,
			"3' Flanking Size",
			500, // default
			0, // min
			1e9, // max
			500 // step
		)

		const isChecked = this.dtUsage[dtsv]?.checked ?? false
		right.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'SV (Structural Variants)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtsv].checked = checked
				right.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Function for adding options cells
	private addOptsTd = tr => {
		return tr
			.append('td')
			.style('padding', this.tableCellPadding)
			.style('border-bottom', `1px solid ${this.borderColor}`)
	}

	// Enable the Run button only if at least one data type is checked
	private updateRunButtonState() {
		const anyChecked = Object.values(this.dtUsage).some(info => info.checked)

		if (anyChecked) {
			this.runButton.property('disabled', false)
		} else {
			this.runButton.property('disabled', true)
		}
	}

	private createConfigTable() {
		const tableDiv = this.dom.controls.append('div').style('display', 'inline-block')

		tableDiv
			.append('p')
			.style('font-size', `${this.headerFontSize}px`)
			.style('font-weight', `${this.headerFontWeight}`)
			.style('margin', `${this.headerMargin}px`)
			.style('text-align', 'center')
			.text('Set up analysis')

		const table = table2col({
			holder: tableDiv
		})
		const queries = this.app.vocabApi.termdbConfig.queries
		this.dtUsage = {}
		if (queries.snvindel) {
			this.dtUsage[dtsnvindel] = {
				checked: true,
				label: 'SNV/INDEL (Mutation)'
			}
			this.addSnvindelRow(table)
		}

		if (queries.cnv) {
			this.dtUsage[dtcnv] = {
				checked: true,
				label: 'CNV (Copy Number Vation)'
			}
			this.addCnvRow(table)
		}
		// Additional check because svfusion query comes packaged with both fusion and sv.
		// Use the dtLst to see which is actually present.
		if (queries.svfusion?.dtLst) {
			for (const dt of queries.svfusion.dtLst) {
				if (dt === dtfusionrna) {
					this.dtUsage[dt] = {
						checked: false,
						label: 'Fusion (RNA Fusion Events)'
					}
					this.addFusionRow(table)
				} else if (dt === dtsv) {
					this.dtUsage[dt] = {
						checked: false,
						label: 'SV (Structural Variants)'
					}
					this.addSvRow(table)
				}
			}
		}

		// Run Button
		this.runButton = tableDiv
			.append('div')
			.style('text-align', 'center')
			.style('margin-top', '15px')
			.append('button')
			.style('padding', this.btnPadding)
			.style('background', this.btnBackgroundColor)
			.style('color', this.btnTextColor)
			.style('border', `1px solid ${this.btnBorderColor}`)
			.style('border-radius', this.btnBorderRadius)
			.style('font-size', `${this.btnFontSize}px`)
			.text('Run GRIN2')
			.on('click', () => this.runAnalysis())
			.on('mouseover', () => {
				this.runButton.style('background', this.btnHoverBackgroundColor)
			})
			.on('mouseout', () => {
				this.runButton.style('background', this.btnBackgroundColor)
			})
		// Set initial button state
		this.updateRunButtonState()
	}

	// Helper method to add option rows to table2col instances
	private addOptionRowToTable(
		table: any,
		label: string,
		defaultValue: number,
		min?: number,
		max?: number,
		step?: number
	) {
		const [labelCell, inputCell] = table.addRow()
		labelCell.text(label).style('font-size', `${this.optionsTextFontSize}px`)

		const input = inputCell
			.append('input')
			.attr('type', 'number')
			.attr('value', defaultValue)
			.style('width', this.inputWidth)
			.style('padding', this.inputPadding)
			.style('border', `1px solid ${this.inputBorderColor}`)
			.style('border-radius', this.inputBorderRadius)
			.style('font-size', `${this.optionsTextFontSize}px`)

		if (min !== null && min !== undefined) input.attr('min', min)
		if (max !== null && max !== undefined) input.attr('max', max)
		if (step !== null && step !== undefined) input.attr('step', step)

		return input
	}

	private createConsequenceCheckboxes(container: any) {
		const snvIndelClasses = Object.entries(mclass).filter(
			([key, cls]: [string, any]) => cls.dt === dtsnvindel && key !== 'Blank' && key !== 'WT'
		)

		// Define default checked consequences
		const defaultChecked = new Set(['M', 'N', 'I', 'L', 'StartLost', 'F', 'D', 'ProteinAltering', 'StopLost'])

		// Create Select All/Clear All controls
		const controlDiv = container
			.append('div')
			.style('margin-bottom', '6px')
			.style('display', 'flex')
			.style('gap', this.controlGap)

		const selectAllBtn = controlDiv
			.append('button')
			.attr('class', 'grin2-control-btn')
			.style('padding', this.btnSmallPadding)
			.style('font-size', `${this.tableFontSize}px`)
			.style('border', `1px solid ${this.btnBorderColor}`)
			.style('background', this.btnBackgroundColor)
			.style('color', this.btnTextColor)
			.style('border-radius', this.btnBorderRadius)
			.text('Select All')

		const clearAllBtn = controlDiv
			.append('button')
			.attr('class', 'grin2-control-btn')
			.style('padding', this.btnSmallPadding)
			.style('font-size', `${this.tableFontSize}px`)
			.style('border', `1px solid ${this.btnBorderColor}`)
			.style('background', this.btnBackgroundColor)
			.style('color', this.btnTextColor)
			.style('border-radius', this.btnBorderRadius)
			.text('Clear All')

		// Create checkbox container
		const checkboxContainer = container
			.append('div')
			.style('max-height', this.checkboxContainerMaxHeight)
			.style('overflow-y', 'auto')
			.style('border', this.checkboxContainerBorder)
			.style('padding', this.checkboxContainerPadding)
			.style('background', this.checkboxContainerBackground)
			.style('border-radius', this.checkboxContainerBorderRadius)

		// Store checkbox references for bulk operations
		const checkboxes: any[] = []

		// Create individual checkboxes using make_one_checkbox
		snvIndelClasses.forEach(([classKey, classInfo]: [string, any]) => {
			const checkboxDiv = checkboxContainer.append('div').style('margin-bottom', this.checkboxMarginBottom)

			const checkbox = make_one_checkbox({
				holder: checkboxDiv,
				labeltext: classInfo.label,
				checked: defaultChecked.has(classKey),
				divstyle: {
					'font-size': `${this.tableFontSize}px`,
					margin: '0',
					display: 'flex',
					'align-items': 'center'
				},
				callback: async (_isChecked: boolean) => {
					// Update data attribute for retrieval in getConfigValues
					checkbox.attr('data-consequence', classKey)
				}
			})

			// Set data attribute for config retrieval
			checkbox.attr('data-consequence', classKey)

			// Set title attribute on the label for tooltip
			checkboxDiv.select('label').attr('title', classInfo.desc || classInfo.label)

			checkboxes.push(checkbox)
		})

		// Select All button functionality
		selectAllBtn
			.on('click', () => {
				checkboxes.forEach(checkbox => checkbox.property('checked', true))
				selectAllBtn.style('background', this.btnBackgroundColor).style('color', this.btnTextColor)
			})
			.on('mouseover', () => {
				selectAllBtn.style('background', this.btnHoverBackgroundColor)
			})
			.on('mouseout', () => {
				selectAllBtn.style('background', this.btnBackgroundColor)
			})

		// Clear All button functionality
		clearAllBtn
			.on('click', () => {
				checkboxes.forEach(checkbox => checkbox.property('checked', false))
				clearAllBtn.style('background', this.btnBackgroundColor).style('color', this.btnTextColor)
			})
			.on('mouseover', () => {
				clearAllBtn.style('background', this.btnHoverBackgroundColor)
			})
			.on('mouseout', () => {
				clearAllBtn.style('background', this.btnBackgroundColor)
			})
	}

	private getConfigValues(): any {
		const requestConfig: any = {}

		if (this.dtUsage[dtsnvindel]?.checked) {
			requestConfig.snvindelOptions = {
				minTotalDepth: parseFloat(this.dom.snvindel_minTotalDepth.property('value')),
				minAltAlleleCount: parseFloat(this.dom.snvindel_minAltAlleleCount.property('value')),
				consequences: this.getSelectedConsequences(),
				fivePrimeFlankSize: parseFloat(this.dom.snvindel_five_prime_flank_size.property('value')),
				threePrimeFlankSize: parseFloat(this.dom.snvindel_three_prime_flank_size.property('value'))
			}
		}

		if (this.dtUsage[dtcnv]?.checked) {
			requestConfig.cnvOptions = {
				lossThreshold: parseFloat(this.dom.cnv_lossThreshold.property('value')),
				gainThreshold: parseFloat(this.dom.cnv_gainThreshold.property('value')),
				maxSegLength: parseFloat(this.dom.cnv_maxSegLength.property('value')),
				fivePrimeFlankSize: parseFloat(this.dom.cnv_five_prime_flank_size.property('value')),
				threePrimeFlankSize: parseFloat(this.dom.cnv_three_prime_flank_size.property('value'))
			}
		}

		if (this.dtUsage[dtfusionrna]?.checked) {
			requestConfig.fusionOptions = {
				fivePrimeFlankSize: parseFloat(this.dom.fusion_five_prime_flank_size.property('value')),
				threePrimeFlankSize: parseFloat(this.dom.fusion_three_prime_flank_size.property('value'))
			}
		}

		if (this.dtUsage[dtsv]?.checked) {
			requestConfig.svOptions = {
				fivePrimeFlankSize: parseFloat(this.dom.sv_five_prime_flank_size.property('value')),
				threePrimeFlankSize: parseFloat(this.dom.sv_three_prime_flank_size.property('value'))
			}
		}

		return requestConfig
	}

	private getSelectedConsequences(): string[] {
		const consequences: string[] = []

		this.dom.controls.selectAll('input[data-consequence]').each(function (this: HTMLInputElement) {
			if (this.checked) {
				const consequence = this.getAttribute('data-consequence')
				if (consequence) consequences.push(consequence)
			}
		})

		return consequences
	}

	private async runAnalysis() {
		try {
			// Disable button with visual feedback
			this.runButton
				.property('disabled', true)
				.text('Running GRIN2...')
				.style('opacity', this.disabledOpacity)
				.style('background', this.btnDisabledBackgroundColor)
				.style('color', this.btnDisabledTextColor)

			// Clear previous results
			this.dom.div.style('padding', '0').text('')
			this.dom.div.selectAll('*').remove()

			// Get configuration and make request
			const configValues = this.getConfigValues()
			const requestData = {
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				filter: this.state.termfilter.filter,
				width: this.state.config.settings.grin2.manhattan?.plotWidth,
				height: this.state.config.settings.grin2.manhattan?.plotHeight,
				pngDotRadius: this.state.config.settings.grin2.manhattan?.pngDotRadius,
				devicePixelRatio: window.devicePixelRatio,
				...configValues
			}

			console.log('GRIN2 Request', requestData)

			const response = await dofetch3('/grin2', {
				body: requestData
			})

			if (response.status === 'error') {
				sayerror(this.dom.div, `GRIN2 analysis failed: ${response.error}`)
				return
			}

			this.renderResults(response)
		} catch (error) {
			this.dom.div.selectAll('*').remove()
			sayerror(this.dom.div, `Error running GRIN2: ${error instanceof Error ? error.message : error}`)
		} finally {
			// Restore button state
			this.runButton
				.property('disabled', false)
				.text('Run GRIN2')
				.style('opacity', this.enabledOpacity)
				.style('background', this.btnBackgroundColor)
				.style('color', this.btnTextColor)
		}
	}

	async init() {
		await this.setControls()
	}

	async main() {
		// Initialize the table with the different data types and options
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
	}

	private renderResults(result: any) {
		// Display Manhattan plot
		if (result.pngImg) {
			const plotData = result
			const plotDiv = this.dom.div
			const manhattanSettings = this.state.config.settings.grin2.manhattan
			plotManhattan(plotDiv, plotData, manhattanSettings)
		}

		// Display top genes table
		if (result.topGeneTable) {
			const tableContainer = this.dom.div.append('div').style('margin', this.sectionMargin)

			// Create header with title and Matrix button
			const headerDiv = tableContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', this.btnMargin)

			headerDiv
				.append('h3')
				.style('margin', this.headerMargin)
				.style('font-size', `${this.headerFontSize}px`)
				.text(`Top Genes (showing ${result.showingTop?.toLocaleString()} of ${result.totalGenes?.toLocaleString()})`)

			// Add Matrix button
			const matrixBtn = headerDiv
				.append('button')
				.style('padding', this.btnSmallPadding)
				.style('background', this.btnBackgroundColor)
				.style('color', this.btnTextColor)
				.style('border', `1px solid ${this.btnBorderColor}`)
				.style('border-radius', this.btnBorderRadius)
				.style('font-size', `${this.btnFontSize}px`)
				.style('margin-left', this.btnMargin)
				.text('Matrix')
				.on('click', () => this.createMatrixFromGenes(result.topGeneTable))
				.on('mouseover', function (this: HTMLElement) {
					this.style.background = '#e0e0e0' // Use btnHoverBackgroundColor if accessible
				})
				.on('mouseout', () => {
					matrixBtn.style('background', this.btnBackgroundColor)
				})

			const tableDiv = tableContainer.append('div')

			renderTable({
				columns: result.topGeneTable.columns,
				rows: result.topGeneTable.rows,
				div: tableDiv,
				showLines: true,
				striped: true,
				showHeader: true,
				maxHeight: '400px',
				maxWidth: '100%',
				dataTestId: 'grin2-top-genes-table',
				selectAll: true,
				download: {
					fileName: `grin2_top_genes_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.tsv`
				},
				header: {
					allowSort: true,
					style: {
						'font-weight': 'bold',
						'background-color': this.backgroundColor
					}
				}
			})
		}

		// Display run stats information
		if (result.processingSummary) {
			// Create header with title
			const headerDiv = this.dom.div
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', this.btnMargin)

			headerDiv
				.append('h3')
				.style('margin', this.headerMargin)
				.style('font-size', `${this.headerFontSize}px`)
				.text('GRIN2 Processing Summary')

			// Using table2col for processing summary
			const table = table2col({
				holder: this.dom.div.append('div'),
				margin: this.btnMargin
			})

			table.addRow('Total Samples', result.processingSummary.totalSamples.toLocaleString())
			table.addRow('Processed Samples', result.processingSummary.processedSamples.toLocaleString())
			table.addRow('Unprocessed Samples', (result.processingSummary.unprocessedSamples ?? 0).toLocaleString())
			table.addRow('Failed Samples', result.processingSummary.failedSamples.toLocaleString())
			table.addRow(
				'Failed Files',
				result.processingSummary.failedFiles?.length
					? result.processingSummary.failedFiles.map(f => f.sampleName).join(', ')
					: '0'
			)
			table.addRow('Total Lesions', result.processingSummary.totalLesions.toLocaleString())
			table.addRow('Processed Lesions', result.processingSummary.processedLesions.toLocaleString())
		}

		// Display timing information
		if (result.timing) {
			this.dom.div
				.append('div')
				.style('margin', this.sectionMargin)
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('color', this.optionsTextColor)
				.text(
					`Analysis completed in ${result.timing.totalTime}s (Processing: ${result.timing.processingTime}s, GRIN2: ${result.timing.grin2Time}s)`
				)
		}

		// If we didn't process all samples, note that caps truncated the run
		if (result.processingSummary.processedSamples < result.processingSummary.totalSamples) {
			this.dom.div
				.append('div')
				.style('margin', this.sectionMargin)
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('color', this.optionsTextColor)
				.text(
					`Note: Per-type lesion caps were reached before all samples could be processed. ` +
						`Analysis ran on ${result.processingSummary?.processedSamples} of ${result.processingSummary?.totalSamples} samples.`
				)
		}
	}

	private async createMatrixFromGenes(topGeneTable: any): Promise<void> {
		try {
			// Extract top 20 gene symbols
			const geneSymbols = topGeneTable.rows
				.slice(0, 20)
				.map((row: any) => row[0]?.value)
				.filter((gene: any) => gene && typeof gene === 'string')

			if (geneSymbols.length === 0) {
				sayerror(this.dom.div, 'No valid gene symbols found')
			}

			// Create termwrappers for mutation data
			const termwrappers = await Promise.all(
				geneSymbols.map(async (gene: string) => {
					const term = {
						type: 'geneVariant',
						gene: gene,
						name: gene
					}

					// Get minimal copy for $id generation (required parameter)
					const minTwCopy = this.app.vocabApi.getTwMinCopy({ term })

					return {
						$id: await get$id(minTwCopy), // Await the async get$id call
						term,
						q: {}
					}
				})
			)

			// Create and dispatch matrix
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'matrix',
					dataType: 'geneVariant',
					termgroups: [
						{
							name: 'Genomic alterations',
							lst: termwrappers
						}
					]
				}
			})
		} catch (error) {
			sayerror(this.dom.div, `Error creating matrix: ${error instanceof Error ? error.message : error}`)
		}
	}
}

export const grin2Init = getCompInit(GRIN2)
export const componentInit = grin2Init

export function getDefaultSettings(opts) {
	const defaults = {
		manhattan: {
			// Core plot dimensions
			plotWidth: 1000,
			plotHeight: 400,
			pngDotRadius: 2,

			// Layout spacing
			yAxisX: 70,
			yAxisY: 40,
			yAxisSpace: 40,

			// Typography
			fontSize: 12,

			// Legend settings
			showLegend: true,
			legendItemWidth: 80,
			legendDotRadius: 3,
			legendRightOffset: 15,
			legendTextOffset: 12,
			legendVerticalOffset: 4,
			legendFontSize: 12,

			// Interactive dots
			showInteractiveDots: true,
			interactiveDotRadius: 3,
			interactiveDotStrokeWidth: 1
		}
	}

	return Object.assign(defaults, opts?.overrides)
}

export async function getPlotConfig(opts: GRIN2Opts, app: MassAppApi) {
	const queries = app.vocabApi.termdbConfig.queries
	const defaultSettings = getDefaultSettings(opts)
	const settings: any = {
		controls: {},
		manhattan: {
			...defaultSettings.manhattan,
			...opts?.manhattan
		}
	}

	// Dynamically add data type options based on availability
	if (queries?.snvindel) {
		settings.snvindelOptions = {
			minTotalDepth: 10,
			minAltAlleleCount: 2,
			consequences: [],
			hyperMutator: 1000
		}
	}

	if (queries?.cnv) {
		settings.cnvOptions = {
			lossThreshold: -0.4,
			gainThreshold: 0.3,
			maxSegLength: 0,
			hyperMutator: 500
		}
	}

	if (queries?.svfusion) {
		settings.fusionOptions = {
			// Add fusion-specific defaults when needed
		}
	}

	const config = {
		chartType: 'grin2',
		settings: Object.assign(getDefaultSettings(opts), settings),
		hidePlotFilter: true
	}

	return copyMerge(config, opts)
}
