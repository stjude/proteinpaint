import { getCompInit, copyMerge, type RxComponent } from '#rx'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { GRIN2Dom, GRIN2Opts } from './GRIN2Types'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter'
import { Menu, renderTable, table2col, make_one_checkbox, sayerror } from '#dom'
import { dtsnvindel, mclass, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'
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
		opts.holder.classed('sjpp-grin2-main', true)
		this.dom = {
			controls: opts.holder.append('div'), // controls ui on top
			div: opts.holder.append('div').style('margin', '20px'), // result ui on bottom
			tip: new Menu({ padding: '' }),
			geneTip: new Menu({ padding: '' })
		}
		if (opts.header) this.dom.header = opts.header.text('GRIN2')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			config: Object.assign({}, config, {
				settings: {
					grin2: config.settings
				}
			})
		}
	}

	private addSnvindelRow = (table: any) => {
		const [left, right] = table.addRow()

		// Options table
		const t2 = table2col({ holder: right })

		// Top numeric options
		this.dom.snvindel_minTotalDepth = this.addOptionRowToTable(
			t2,
			'Min Total Depth',
			10, // default
			0, // min
			1e6, // max
			1 // step
		)
		this.dom.snvindel_minAltAlleleCount = this.addOptionRowToTable(t2, 'Min Alt Allele Count', 2, 0, 1e6, 1)

		// if 5/3 flanking size will be needed in future, can create a helper this.addFlankingOption() to dedup

		// // 5' flanking size
		// this.dom.snvindel_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )
		// // 3' flanking size
		// this.dom.snvindel_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// Consequences section header + checkbox grid
		{
			const [labelCell, containerCell] = t2.addRow()
			labelCell
				.text('Consequences')
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('font-weight', '600')
				.style('padding-top', '8px')

			// Build the consequence checkboxes in the right cell
			this.createConsequenceCheckboxes(containerCell)
		}

		// ----- Left-side SNV/INDEL checkbox -----
		const isChecked = this.dtUsage[dtsnvindel].checked
		t2.table.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'SNV/INDEL (Mutation)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtsnvindel].checked = checked
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Add CNV row
	private addCnvRow = (table: any) => {
		const [left, right] = table.addRow()

		// CNV options table
		const t2 = table2col({ holder: right })

		// Loss Threshold
		this.dom.cnv_lossThreshold = this.addOptionRowToTable(
			t2,
			'Loss Threshold',
			-0.4, // default
			-5, // min
			0, // max
			0.05 // step
		)

		// Gain Threshold
		this.dom.cnv_gainThreshold = this.addOptionRowToTable(
			t2,
			'Gain Threshold',
			0.3, // default
			0, // min
			5, // max
			0.05 // step
		)

		// Max Segment Length (0 = no cap)
		this.dom.cnv_maxSegLength = this.addOptionRowToTable(
			t2,
			'Max Segment Length',
			0, // default (no cap)
			0, // min
			1e9, // max
			1000 // step
		)

		// // 5' flanking size
		// this.dom.cnv_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// // 3' flanking size
		// this.dom.cnv_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// ----- Left-side CNV checkbox -----
		const isChecked = this.dtUsage[dtcnv].checked
		t2.table.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'CNV (Copy Number Variation)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtcnv].checked = checked
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Add Fusion row
	private addFusionRow = (table: any) => {
		const [left, right] = table.addRow()

		// Fusion options table
		const t2 = table2col({ holder: right })

		// // 5' flanking size
		// this.dom.fusion_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// // 3' flanking size
		// this.dom.fusion_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		const isChecked = this.dtUsage[dtfusionrna].checked
		t2.table.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'Fusion (RNA Fusion Events)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtfusionrna].checked = checked
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Add SV row
	private addSvRow = (table: any) => {
		const [left, right] = table.addRow()

		// SV options table
		const t2 = table2col({ holder: right })

		// // 5' flanking size
		// this.dom.sv_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// // 3' flanking size
		// this.dom.sv_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		const isChecked = this.dtUsage[dtsv].checked
		t2.table.style('display', isChecked ? '' : 'none')

		make_one_checkbox({
			holder: left,
			labeltext: 'SV (Structural Variants)',
			checked: isChecked,
			callback: (checked: boolean) => {
				this.dtUsage[dtsv].checked = checked
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonState()
			}
		})
	}

	// Enable the Run button only if at least one data type is checked
	private updateRunButtonState() {
		const anyChecked = Object.values(this.dtUsage).some(info => info.checked)
		this.runButton.property('disabled', !anyChecked)
	}

	private createConfigTable() {
		const table = table2col({ holder: this.dom.controls, disableScroll: true })
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
		if (queries.svfusion?.dtLst?.includes(dtfusionrna)) {
			this.dtUsage[dtfusionrna] = {
				checked: false,
				label: 'Fusion (RNA Fusion Events)'
			}
			this.addFusionRow(table)
		}
		if (queries.svfusion?.dtLst?.includes(dtsv)) {
			this.dtUsage[dtsv] = {
				checked: false,
				label: 'SV (Structural Variants)'
			}
			this.addSvRow(table)
		}

		// Run Button
		this.runButton = this.dom.controls
			.append('button')
			.style('margin-left', '100px')
			.text('Run GRIN2')
			.on('click', () => this.runAnalysis())
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
				consequences: this.getSelectedConsequences()
				// fivePrimeFlankSize: parseFloat(this.dom.snvindel_five_prime_flank_size.property('value')),
				// threePrimeFlankSize: parseFloat(this.dom.snvindel_three_prime_flank_size.property('value'))
			}
		}

		if (this.dtUsage[dtcnv]?.checked) {
			requestConfig.cnvOptions = {
				lossThreshold: parseFloat(this.dom.cnv_lossThreshold.property('value')),
				gainThreshold: parseFloat(this.dom.cnv_gainThreshold.property('value')),
				maxSegLength: parseFloat(this.dom.cnv_maxSegLength.property('value'))
				// fivePrimeFlankSize: parseFloat(this.dom.cnv_five_prime_flank_size.property('value')),
				// threePrimeFlankSize: parseFloat(this.dom.cnv_three_prime_flank_size.property('value'))
			}
		}

		if (this.dtUsage[dtfusionrna]?.checked) {
			requestConfig.fusionOptions = {
				// fivePrimeFlankSize: parseFloat(this.dom.fusion_five_prime_flank_size.property('value')),
				// threePrimeFlankSize: parseFloat(this.dom.fusion_three_prime_flank_size.property('value'))
			}
		}

		if (this.dtUsage[dtsv]?.checked) {
			requestConfig.svOptions = {
				// fivePrimeFlankSize: parseFloat(this.dom.sv_five_prime_flank_size.property('value')),
				// threePrimeFlankSize: parseFloat(this.dom.sv_three_prime_flank_size.property('value'))
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
			this.runButton.property('disabled', true).text('Running GRIN2...')

			// Clear previous results
			this.dom.div.selectAll('*').remove()

			// Get configuration and make request
			const configValues = this.getConfigValues()
			const requestData = {
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				filter: getNormalRoot(this.state.termfilter.filter),
				width: this.state.config.settings.grin2.manhattan?.plotWidth,
				height: this.state.config.settings.grin2.manhattan?.plotHeight,
				pngDotRadius: this.state.config.settings.grin2.manhattan?.pngDotRadius,
				devicePixelRatio: window.devicePixelRatio,
				maxGenesToShow: this.state.config.settings.grin2?.manhattan?.maxGenesToShow,
				...configValues
			}

			const response = await dofetch3('/grin2', {
				body: requestData
			})

			if (response.status === 'error') throw `GRIN2 analysis failed: ${response.error}`

			this.renderResults(response)
		} catch (error) {
			sayerror(this.dom.div, `Error running GRIN2: ${error instanceof Error ? error.message : error}`)
		} finally {
			// Restore button state
			this.runButton.property('disabled', false).text('Run GRIN2')
		}
	}

	async init() {
		this.createConfigTable()
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
			plotManhattan(plotDiv, plotData, manhattanSettings, this.app)
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
				.text('Matrix (0 genes selected)')
				.property('disabled', true)
				.on('click', () => {
					matrixBtn.property('disabled', true) // matrix is expensive. disable to prevent repeated clicking
					this.createMatrixFromGenes(selectedGenes)
				})

			const tableDiv = tableContainer.append('div')
			const selectedGenes: string[] = []

			renderTable({
				columns: result.topGeneTable.columns,
				rows: result.topGeneTable.rows,
				div: tableDiv,
				maxHeight: '400px',
				maxWidth: '100%',
				dataTestId: 'grin2-top-genes-table',
				noButtonCallback: (rowIndex, checkboxNode) => {
					// Get the gene name from the first column of the selected row
					const geneName = result.topGeneTable.rows[rowIndex][0]?.value
					if (checkboxNode.checked) {
						selectedGenes.push(geneName)
					} else {
						// Remove gene from array
						selectedGenes.splice(selectedGenes.indexOf(geneName), 1)
					}
					// Update button text after selection changes
					matrixBtn.text(`Matrix (${selectedGenes.length} genes selected)`).property('disabled', !selectedGenes.length)
				},
				selectAll: false,
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
		const expectedToProcessSamples = result.processingSummary.totalSamples - result.processingSummary.failedSamples
		if (result.processingSummary.processedSamples < expectedToProcessSamples) {
			this.dom.div
				.append('div')
				.style('margin', this.sectionMargin)
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('color', this.optionsTextColor)
				.text(
					`Note: Per-type lesion caps were reached before all samples could be processed. ` +
						`Analysis ran on ${result.processingSummary.processedSamples} of ${expectedToProcessSamples} samples.`
				)
		}
	}

	private async createMatrixFromGenes(geneSymbols: string[]): Promise<void> {
		try {
			if (geneSymbols.length === 0) {
				sayerror(this.dom.div, 'No genes selected. Please select genes from the table.')
				return
			}

			// Create termwrappers for mutation data
			const termwrappers = await Promise.all(
				geneSymbols.map(async (gene: string) => {
					const term = {
						type: 'geneVariant',
						gene: gene,
						name: gene
					}

					// Get minimal copy for $id generation
					const minTwCopy = this.app.vocabApi.getTwMinCopy({ term })

					return {
						$id: await get$id(minTwCopy),
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
			interactiveDotStrokeWidth: 1,

			// Download options
			showDownload: true,

			// Max genes to show in table
			maxGenesToShow: 500
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
