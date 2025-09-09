import { getCompInit, copyMerge, type RxComponentInner } from '#rx'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { GRIN2Dom, GRIN2Opts } from './GRIN2Types'
import { dofetch3 } from '#common/dofetch'
import { Menu, renderTable, icons, table2col, make_one_checkbox } from '#dom'
import { dtsnvindel, mclass } from '#shared/common.js'
import { get$id } from '#termsetting'
import { PlotBase } from '#plots/PlotBase.ts'
import { to_svg } from '#src/client'

class GRIN2 extends PlotBase implements RxComponentInner {
	readonly type = 'grin2'
	dom: GRIN2Dom
	private runButton!: any
	readonly borderColor = '#eee'
	readonly backgroundColor = '#f8f8f8'
	readonly optionsTextColor = '#666'

	constructor(opts: any) {
		super(opts)
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

	private createConfigTable() {
		const tableDiv = this.dom.controls
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '10px')
			.style('margin', '5px')

		// Create manual table structure with headers since it didn't seem like table2col supports headers
		const table = tableDiv.append('table').style('border-collapse', 'collapse').style('width', '100%')

		// Add table headers
		const headerRow = table.append('tr')
		headerRow
			.append('th')
			.style('background', this.backgroundColor)
			.style('padding', '8px')
			.style('font-weight', 'bold')
			.style('border-right', `1px solid ${this.borderColor}`)
			.style('border-bottom', `1px solid ${this.borderColor}`)
			.style('width', '30%')
			.text('Data Type')

		headerRow
			.append('th')
			.style('background', this.backgroundColor)
			.style('padding', '8px')
			.style('font-weight', 'bold')
			.style('border-bottom', `1px solid ${this.borderColor}`)
			.style('width', '70%')
			.text('Options')

		const queries = this.app.vocabApi.termdbConfig.queries

		// Function to use for adding data types
		const addDataTypeTd = (tr, text) => {
			tr.append('td')
				.style('padding', '8px')
				.style('font-weight', '500')
				.style('vertical-align', 'top')
				.style('border-right', `1px solid ${this.borderColor}`)
				.style('border-bottom', `1px solid ${this.borderColor}`)
				.text(text)
		}

		// For adding options
		const addOptsTd = tr => {
			return tr.append('td').style('padding', '8px').style('border-bottom', `1px solid ${this.borderColor}`)
		}

		// SNV/INDEL Section
		if (queries.snvindel) {
			const snvRow = table.append('tr')

			addDataTypeTd(snvRow, 'SNV/INDEL (Mutation)')

			// Create nested table for options using table2col
			const optionsTable = table2col({
				holder: addOptsTd(snvRow),
				cellPadding: '4px'
			})

			this.addOptionRowToTable(optionsTable, 'Min Total Depth', 'snvindelOptions.minTotalDepth', 10, 1)
			this.addOptionRowToTable(optionsTable, 'Min Alt Allele Count', 'snvindelOptions.minAltAlleleCount', 2, 1)
			this.addOptionRowToTable(optionsTable, 'Hypermutator Threshold', 'snvindelOptions.hyperMutator', 1000, 1)

			// Consequence checkboxes
			const [consequenceLabel, consequenceCell] = optionsTable.addRow()
			consequenceLabel.text('Consequences')
			this.createConsequenceCheckboxes(consequenceCell)
		}

		// CNV Section
		if (queries.cnv) {
			const cnvRow = table.append('tr')

			addDataTypeTd(cnvRow, 'CNV (Copy Number Variation)')

			const optionsTable = table2col({
				holder: addOptsTd(cnvRow),
				cellPadding: '4px'
			})

			this.addOptionRowToTable(optionsTable, 'Loss Threshold', 'cnvOptions.lossThreshold', -0.4, undefined, 0, 0.1)
			this.addOptionRowToTable(optionsTable, 'Gain Threshold', 'cnvOptions.gainThreshold', 0.3, 0, undefined, 0.1)
			this.addOptionRowToTable(optionsTable, 'Max Segment Length', 'cnvOptions.maxSegLength', 0, 0)
			this.addOptionRowToTable(optionsTable, 'Hypermutator Threshold', 'cnvOptions.hyperMutator', 500, 1)
		}

		// Fusion Section (placeholder)
		if (queries.svfusion) {
			const fusionRow = table.append('tr')

			addDataTypeTd(fusionRow, 'Fusion (Structural Variation)')
			const msg = addOptsTd(fusionRow)
			msg.append('div').style('color', this.optionsTextColor).text('Fusion filtering options to be configured later')
		}

		// General GRIN2 Section (placeholder)
		const generalRow = table.append('tr')

		addDataTypeTd(generalRow, 'GRIN2')

		const msg = addOptsTd(generalRow)
		msg.append('div').style('color', this.optionsTextColor).text('Additional GRIN2 parameters to be configured later')

		// Run Button
		this.runButton = tableDiv
			.append('div')
			.style('text-align', 'center')
			.style('margin-top', '15px')
			.append('button')
			.style('padding', '8px 16px')
			.style('background', '#f8f8f8')
			.style('color', '#333')
			.style('border', '1px solid #ddd')
			.style('border-radius', '3px')
			.style('cursor', 'pointer')
			.style('font-size', '14px')
			.text('Run GRIN2')
			.on('click', () => this.runAnalysis())
	}

	// Helper method to add option rows to table2col instances
	private addOptionRowToTable(
		table: any,
		label: string,
		configPath: string,
		defaultValue: number,
		min?: number | null,
		max?: number | null,
		step?: number | null
	) {
		const [labelCell, inputCell] = table.addRow()
		labelCell.text(label)

		const input = inputCell
			.append('input')
			.attr('type', 'number')
			.attr('value', defaultValue)
			.style('width', '80px')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ddd')
			.style('border-radius', '2px')

		if (min !== null && min !== undefined) input.attr('min', min)
		if (max !== null && max !== undefined) input.attr('max', max)
		if (step !== null && step !== undefined) input.attr('step', step)

		// Store reference for value retrieval using existing pattern
		input.attr('data-settings-path', configPath)
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
			.style('gap', '8px')

		const selectAllBtn = controlDiv
			.append('button')
			.attr('class', 'grin2-control-btn')
			.style('padding', '2px 8px')
			.style('font-size', '11px')
			.style('border', '1px solid #ccc')
			.style('background', '#f0f0f0')
			.style('cursor', 'pointer')
			.style('border-radius', '3px')
			.text('Select All')

		const clearAllBtn = controlDiv
			.append('button')
			.attr('class', 'grin2-control-btn')
			.style('padding', '2px 8px')
			.style('font-size', '11px')
			.style('border', '1px solid #ccc')
			.style('background', '#f0f0f0')
			.style('cursor', 'pointer')
			.style('border-radius', '3px')
			.text('Clear All')

		// Create checkbox container
		const checkboxContainer = container
			.append('div')
			.style('max-height', '150px')
			.style('overflow-y', 'auto')
			.style('border', '1px solid #ddd')
			.style('padding', '4px')
			.style('background', '#fafafa')
			.style('border-radius', '3px')

		// Store checkbox references for bulk operations
		const checkboxes: any[] = []

		// Create individual checkboxes using make_one_checkbox
		snvIndelClasses.forEach(([classKey, classInfo]: [string, any]) => {
			const checkboxDiv = checkboxContainer.append('div').style('margin-bottom', '2px')

			const checkbox = make_one_checkbox({
				holder: checkboxDiv,
				labeltext: classInfo.label,
				checked: defaultChecked.has(classKey),
				divstyle: {
					'font-size': '11px',
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
		selectAllBtn.on('click', () => {
			checkboxes.forEach(checkbox => checkbox.property('checked', true))
			selectAllBtn.style('background', '#f0f0f0').style('color', '#333')
		})

		// Clear All button functionality
		clearAllBtn.on('click', () => {
			checkboxes.forEach(checkbox => checkbox.property('checked', false))
			clearAllBtn.style('background', '#f0f0f0').style('color', '#333')
		})
	}

	private getConfigValues(): any {
		const config: any = {}

		// Get numeric values
		this.dom.controls.selectAll('input[data-settings-path]').each(function (this: HTMLInputElement) {
			const path = this.getAttribute('data-settings-path')!
			const value = parseFloat(this.value)

			// Set nested object properties
			const parts = path.split('.')
			let current = config
			for (let i = 0; i < parts.length - 1; i++) {
				if (!current[parts[i]]) current[parts[i]] = {}
				current = current[parts[i]]
			}
			current[parts[parts.length - 1]] = value
		})
		// Only add consequences if snvindelOptions was already created by getPlotConfig
		if (config.snvindelOptions) {
			const consequences: string[] = []
			this.dom.controls.selectAll('input[data-consequence]').each(function (this: HTMLInputElement) {
				if (this.checked) {
					consequences.push(this.getAttribute('data-consequence')!)
				}
			})
			config.snvindelOptions.consequences = consequences
		}

		return config
	}

	private async runAnalysis() {
		try {
			// Disable button with visual feedback
			this.runButton.property('disabled', true).text('Running GRIN2...').style('opacity', '0.6')

			// Clear previous results
			this.dom.div.style('padding', '0').text('')
			this.dom.div.selectAll('*').remove()

			// Get configuration and make request
			const configValues = this.getConfigValues()
			const requestData = {
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				filter: this.state.termfilter.filter,
				width: 1000,
				height: 400,
				pngDotRadius: 2,
				devicePixelRatio: window.devicePixelRatio,
				...configValues
			}

			const response = await dofetch3('/grin2', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestData)
			})

			if (response.status === 'error') {
				this.app.printError(`GRIN2 analysis failed: ${response.error}`)
				return
			}

			this.renderResults(response)
		} catch (error) {
			this.dom.div.selectAll('*').remove()
			this.app.printError(`Error: ${error instanceof Error ? error.message : String(error)}`)
		} finally {
			// Restore button state
			this.runButton.property('disabled', false).text('Run GRIN2').style('opacity', '1')
		}
	}

	async init() {
		await this.setControls()
	}

	async main() {
		// Only initialize the table, don't auto-run analysis
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return
	}

	private renderResults(result: any) {
		// Display Manhattan plot
		if (result.pngImg) {
			console.log('GRIN2 result', result)
			console.log('GRIN2 sample number', result.plotData.points.length)
			const plotContainer = this.dom.div.append('div').style('text-align', 'left').style('margin', '20px 0')

			// Create header with title and download button
			const headerDiv = plotContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', '10px 0')

			headerDiv.append('h3').style('margin', '0 10px 0 0').text('GRIN2 Manhattan Plot')

			// Add download button using existing icons system
			const downloadDiv = headerDiv.append('div').style('display', 'inline-block').style('cursor', 'pointer')

			icons['download'](downloadDiv, {
				width: 16,
				height: 16,
				title: 'Download GRIN2 plot',
				handler: () => {
					to_svg(
						svg.node() as SVGSVGElement,
						`grin2_manhattan_plot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`
					)
				}
			})

			const plotData = result.plotData

			const svg = plotContainer.append('svg').attr('width', plotData.plot_width).attr('height', plotData.plot_height)

			// Add the matplotlib background image
			svg
				.append('image')
				.attr('xlink:href', `data:image/png;base64,${result.pngImg}`)
				.attr('width', plotData.plot_width)
				.attr('height', plotData.plot_height)

			// Add visible interactive points using pre-calculated SVG coordinates
			const pointsLayer = svg.append('g')

			pointsLayer
				.selectAll('circle')
				.data(plotData.points)
				.enter()
				.append('circle')
				.attr('cx', d => d.svg_x)
				.attr('cy', d => d.svg_y)
				.attr('r', 6)
				.attr('fill', d => d.color)
				.attr('stroke', 'black')
				.attr('stroke-width', 1)
				.on('mouseover', (event, d) => {
					this.dom.geneTip.clear().show(event.clientX, event.clientY)

					const table = table2col({
						holder: this.dom.geneTip.d.append('div'),
						margin: '10px'
					})
					table.addRow('Gene', d.gene)
					table.addRow('Type', d.type)
					table.addRow('-log10(q-value)', d.y.toFixed(3))
					table.addRow('Count of impacted subjects', d.nsubj)
				})
				.on('mouseout', () => {
					this.dom.geneTip.hide()
				})
		}
		// Display top genes table
		if (result.topGeneTable) {
			const tableContainer = this.dom.div.append('div').style('margin', '20px 0')

			// Create header with title and Matrix button
			const headerDiv = tableContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', '10px 0')

			headerDiv
				.append('h3')
				.style('margin', '0 10px 0 0')
				.text(`Top Genes (showing ${result.showingTop?.toLocaleString()} of ${result.totalGenes?.toLocaleString()})`)

			// Add Matrix button
			headerDiv
				.append('button')
				.style('padding', '6px 12px')
				.style('background', '#f0f0f0')
				.style('color', '#333')
				.style('border', '1px solid #ccc')
				.style('border-radius', '4px')
				.style('cursor', 'pointer')
				.style('font-size', '14px')
				.style('margin-left', '10px')
				.text('Matrix')
				.on('click', () => this.createMatrixFromGenes(result.topGeneTable))

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
						'background-color': '#f5f5f5'
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
				.style('margin', '10px 0')

			headerDiv.append('h3').style('margin', '0 10px 0 0').text('GRIN2 Processing Summary')

			// Using table2col for processing summary
			const table = table2col({
				holder: this.dom.div.append('div'),
				margin: '10px 0'
			})

			Object.entries(result.processingSummary).forEach(([key, value]) => {
				const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
				const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
				table.addRow(displayKey, displayValue)
			})
		}

		// Display timing information
		if (result.timing) {
			this.dom.div
				.append('div')
				.style('margin', '20px 0')
				.style('font-size', '12px')
				.style('color', this.optionsTextColor)
				.text(
					`Analysis completed in ${result.timing.totalTime}s (Processing: ${result.timing.processingTime}s, GRIN2: ${result.timing.grin2Time}s)`
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
				throw new Error('No valid gene symbols found')
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
			console.error('Error creating matrix from genes:', error)
			this.app.printError(`Error creating matrix: ${error instanceof Error ? error.message : 'Unknown error'}`)
		}
	}
}

export const grin2Init = getCompInit(GRIN2)
export const componentInit = grin2Init

export async function getPlotConfig(opts: GRIN2Opts, app: MassAppApi) {
	const queries = app.vocabApi.termdbConfig.queries
	const settings: any = { controls: {} }

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
		settings
	}

	return copyMerge(config, opts)
}

export function makeChartBtnMenu(holder, chartsInstance) {
	const genomeObj = chartsInstance.app.opts.genome
	if (typeof genomeObj != 'object') throw 'chartsInstance.app.opts.genome not an object and needed for GRIN2'

	// Create a simple button for GRIN2 analysis
	const row = holder.append('div').style('margin', '10px')

	row
		.append('button')
		.style('padding', '8px 16px')
		.style('background', '#f0f0f0')
		.style('color', '#333')
		.style('border', '1px solid #ccc')
		.style('border-radius', '4px')
		.style('cursor', 'pointer')
		.text('Configure GRIN2 Analysis')
		.on('click', async () => {
			try {
				// Open the configuration sandbox instead of auto-running
				const config = await getPlotConfig({}, chartsInstance.app)
				chartsInstance.prepPlot({ config })
			} catch (e: any) {
				holder
					.append('div')
					.style('color', 'red')
					.style('margin-top', '10px')
					.text(`Error: ${e.message || e}`)
				console.log(e)
			}
		})
}
