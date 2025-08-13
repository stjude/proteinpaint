import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { GRIN2Dom, GRIN2Opts, GRIN2Settings } from './GRIN2Types'
import { Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { renderTable, icons } from '#dom'
import { dtsnvindel, mclass } from '#shared/common.js'

class GRIN2 extends RxComponentInner {
	readonly type = 'grin2'
	dom: GRIN2Dom

	constructor(opts: any) {
		super()
		this.opts = opts
		const holder = opts.holder.classed('sjpp-grin2-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')
		const errorDiv = div.append('div').attr('id', 'sjpp-grin2-error').style('opacity', 0.75)
		const plotDiv = div.append('div').attr('id', 'sjpp-grin2-plot')

		this.dom = {
			controls: controls.style('display', 'block'),
			div,
			error: errorDiv,
			plot: plotDiv,
			tip: new Menu({ padding: '' })
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
					grin2: config.settings.grin2
				}
			})
		}
	}

	async setControls() {
		this.createConfigTable()
	}

	private createMatrixFromGenes(topGeneTable: any) {
		try {
			// Check if gene expression data is available
			const queries = this.app.vocabApi.termdbConfig.queries
			const hasRnaseqData = !!queries?.rnaseqGeneCount

			// Create message based on whether rnaseq data is available
			const availabilityMessage = hasRnaseqData
				? 'This dataset contains RNA-seq gene expression data.'
				: 'Note: This dataset does not contain RNA-seq gene expression data (rnaseqGeneCount).'

			// Show coming soon message with data availability info
			const messageDiv = this.dom.plot
				.append('div')
				.style('background', '#f8f9fa')
				.style('border', '1px solid #dee2e6')
				.style('border-radius', '8px')
				.style('padding', '20px')
				.style('margin', '10px 0')
				.style('text-align', 'center')

			messageDiv
				.append('h4')
				.style('color', '#495057')
				.style('margin', '0 0 10px 0')
				.text('🔬 Gene Expression Matrix - Coming Soon')

			messageDiv
				.append('p')
				.style('color', '#6c757d')
				.style('margin', '10px 0')
				.text(
					`Expression matrix visualization for the ${topGeneTable.rows.length} genes from your GRIN2 analysis is currently under development.`
				)

			messageDiv
				.append('div')
				.style('margin-top', '15px')
				.style('padding', '10px')
				.style('background', hasRnaseqData ? '#d4edda' : '#f8d7da')
				.style('border', `1px solid ${hasRnaseqData ? '#c3e6cb' : '#f5c6cb'}`)
				.style('border-radius', '4px')
				.style('color', hasRnaseqData ? '#155724' : '#721c24')
				.style('font-size', '14px')
				.text(availabilityMessage)

			// Auto-remove message after 8 seconds
			setTimeout(() => messageDiv.remove(), 8000)
		} catch (error) {
			console.error('Error showing matrix message:', error)
			// Show error to user in the existing error div
			this.dom.error
				.style('padding', '20px')
				.style('color', 'red')
				.text(`Error: ${error instanceof Error ? error.message : String(error)}`)

			// Auto-hide error after 5 seconds
			setTimeout(() => {
				this.dom.error.style('padding', '0').text('')
			}, 5000)
		}
	}

	private createConfigTable() {
		const tableDiv = this.dom.controls
			.append('div')
			.style('display', 'inline-block')
			.style('border', '1px solid #ddd')
			.style('border-radius', '4px')
			.style('padding', '15px')
			.style('background', '#fafafa')
			.style('margin', '10px')

		const table = tableDiv.append('table').style('border-collapse', 'collapse').style('width', '100%')

		const queries = this.app.vocabApi.termdbConfig.queries
		console.log('Queries:', queries)

		// Table headers
		const headerRow = table.append('tr')
		headerRow
			.append('th')
			.style('background', '#e9e9e9')
			.style('padding', '8px')
			.style('font-weight', 'bold')
			.style('border', '1px solid #ddd')
			.style('width', '30%')
			.text('Data Type')

		headerRow
			.append('th')
			.style('background', '#e9e9e9')
			.style('padding', '8px')
			.style('font-weight', 'bold')
			.style('border', '1px solid #ddd')
			.style('width', '70%')
			.text('Options')

		// SNV/INDEL Row
		if (queries.snvindel) {
			const snvRow = table.append('tr')

			snvRow
				.append('td')
				.style('padding', '8px')
				.style('border', '1px solid #ddd')
				.style('font-weight', '500')
				.style('vertical-align', 'top')
				.text('SNV/INDEL (Mutation)')

			const optionsCell = snvRow.append('td').style('padding', '8px').style('border', '1px solid #ddd')

			const optionsTable = optionsCell.append('table').style('border-collapse', 'collapse').style('width', '100%')

			this.addOptionRow(optionsTable, 'Min Total Depth', 'snvindelOptions.minTotalDepth', 10, 1)
			this.addOptionRow(optionsTable, 'Min Alt Allele Count', 'snvindelOptions.minAltAlleleCount', 2, 1)
			this.addOptionRow(optionsTable, 'Hypermutator Threshold', 'snvindelOptions.hyperMutator', 1000, 1)

			// Consequence checkboxes section
			const consequenceRow = optionsTable.append('tr')
			consequenceRow
				.append('td')
				.style('padding', '4px 8px')
				.style('font-weight', '400')
				.style('vertical-align', 'top')
				.text('Consequences')

			const consequenceCell = consequenceRow.append('td').style('padding', '4px 8px')

			// Create consequence checkboxes
			this.createConsequenceCheckboxes(consequenceCell)
		}

		// CNV Row
		if (queries.cnv) {
			const cnvRow = table.append('tr')

			cnvRow
				.append('td')
				.style('padding', '8px')
				.style('border', '1px solid #ddd')
				.style('font-weight', '500')
				.style('vertical-align', 'top')
				.text('CNV (Copy Number Variation)')

			const optionsCell = cnvRow.append('td').style('padding', '8px').style('border', '1px solid #ddd')

			const optionsTable = optionsCell.append('table').style('border-collapse', 'collapse').style('width', '100%')

			this.addOptionRow(optionsTable, 'Loss Threshold', 'cnvOptions.lossThreshold', -0.4, null, 0, 0.1)
			this.addOptionRow(optionsTable, 'Gain Threshold', 'cnvOptions.gainThreshold', 0.3, 0, null, 0.1)
			this.addOptionRow(optionsTable, 'Max Segment Length', 'cnvOptions.maxSegLength', 0, 0)
			this.addOptionRow(optionsTable, 'Hypermutator Threshold', 'cnvOptions.hyperMutator', 500, 1)
		}

		// Fusion Row (placeholder)
		if (queries.svfusion) {
			const fusionRow = table.append('tr')

			fusionRow
				.append('td')
				.style('padding', '8px')
				.style('border', '1px solid #ddd')
				.style('font-weight', '500')
				.style('vertical-align', 'top')
				.text('Fusion')

			fusionRow
				.append('td')
				.style('padding', '8px')
				.style('border', '1px solid #ddd')
				.style('font-style', 'italic')
				.style('color', '#666')
				.text('Fusion filtering options to be configured later')
		}

		// General GRIN2 Row (placeholder)
		const generalRow = table.append('tr')

		generalRow
			.append('td')
			.style('padding', '8px')
			.style('border', '1px solid #ddd')
			.style('font-weight', '500')
			.style('vertical-align', 'top')
			.text('GRIN2')

		generalRow
			.append('td')
			.style('padding', '8px')
			.style('border', '1px solid #ddd')
			.style('font-style', 'italic')
			.style('color', '#666')
			.text('Additional GRIN2 parameters to be configured later')

		// Run Button
		tableDiv
			.append('div')
			.style('text-align', 'center')
			.style('margin-top', '20px')
			.append('button')
			.style('padding', '10px 20px')
			.style('background', '#f0f0f0')
			.style('color', '#333')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('cursor', 'pointer')
			.style('font-size', '16px')
			.text('Run GRIN2')
			.on('click', () => this.runAnalysis())
	}

	private createConsequenceCheckboxes(container: any) {
		const snvIndelClasses = Object.entries(mclass).filter(
			([key, cls]: [string, any]) => cls.dt === dtsnvindel && key !== 'Blank' && key !== 'WT'
		)

		// Define default checked consequences (high impact)
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

		// Create individual checkboxes
		snvIndelClasses.forEach(([classKey, classInfo]: [string, any]) => {
			const checkboxDiv = checkboxContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin-bottom', '2px')
				.style('font-size', '11px')

			// Checkbox with data attribute for easy retrieval
			checkboxDiv
				.append('input')
				.attr('type', 'checkbox')
				.attr('data-consequence', classKey)
				.property('checked', defaultChecked.has(classKey))
				.style('margin-right', '4px')

			// Label
			checkboxDiv
				.append('label')
				.style('cursor', 'pointer')
				.text(classInfo.label)
				.attr('title', classInfo.desc || classInfo.label)
				.on('click', function () {
					// Toggle checkbox when label is clicked
					const checkbox = checkboxDiv.select('input').node()
					checkbox.checked = !checkbox.checked
				})
		})

		// Select All button functionality
		selectAllBtn.on('click', () => {
			checkboxContainer.selectAll('input[data-consequence]').property('checked', true)
			// Reset button styling immediately after click
			selectAllBtn.style('background', '#f0f0f0').style('color', '#333')
		})

		// Clear All button functionality
		clearAllBtn.on('click', () => {
			checkboxContainer.selectAll('input[data-consequence]').property('checked', false)
			// Reset button styling immediately after click
			clearAllBtn.style('background', '#f0f0f0').style('color', '#333')
		})
	}

	private addOptionRow(
		table: any,
		label: string,
		settingsPath: string,
		defaultValue: number,
		min?: number | null,
		max?: number | null,
		step: number = 1
	) {
		const row = table.append('tr')

		// Label column
		row.append('td').style('padding', '4px 8px').style('font-weight', '400').style('width', '60%').text(label)

		// Input column
		const inputCell = row.append('td').style('padding', '4px 8px').style('width', '40%')

		const input = inputCell
			.append('input')
			.attr('type', 'number')
			.attr('value', defaultValue)
			.attr('step', step)
			.style('width', '100%')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '2px')
			.style('font-size', '12px')

		if (min !== null && min !== undefined) input.attr('min', min)
		if (max !== null && max !== undefined) input.attr('max', max)

		// Store reference for value retrieval
		input.attr('data-settings-path', settingsPath)
	}

	private addSectionHeader(table: any, title: string) {
		const row = table.append('tr')
		row
			.append('td')
			.attr('colspan', '2')
			.style('background', '#e9e9e9')
			.style('padding', '8px')
			.style('font-weight', 'bold')
			.style('border-bottom', '1px solid #ddd')
			.text(title)
	}

	private addNumberInput(
		table: any,
		label: string,
		settingsPath: string,
		defaultValue: number,
		min?: number | null,
		max?: number | null,
		step: number = 1
	) {
		const row = table.append('tr')

		// Label column
		row
			.append('td')
			.style('padding', '8px')
			.style('border-bottom', '1px solid #eee')
			.style('font-weight', '500')
			.style('width', '50%')
			.text(label)

		// Input column
		const inputCell = row
			.append('td')
			.style('padding', '8px')
			.style('border-bottom', '1px solid #eee')
			.style('width', '50%')

		const input = inputCell
			.append('input')
			.attr('type', 'number')
			.attr('value', defaultValue)
			.attr('step', step)
			.style('width', '100%')
			.style('padding', '4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '2px')

		if (min !== null && min !== undefined) input.attr('min', min)
		if (max !== null && max !== undefined) input.attr('max', max)

		// Store reference for value retrieval
		input.attr('data-settings-path', settingsPath)
	}

	private addPlaceholderText(table: any, text: string) {
		const row = table.append('tr')
		row
			.append('td')
			.attr('colspan', '2')
			.style('padding', '8px')
			.style('border-bottom', '1px solid #eee')
			.style('font-style', 'italic')
			.style('color', '#666')
			.style('text-align', 'center')
			.text(text)
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

		// Get checked consequences directly
		const consequences: string[] = []
		this.dom.controls.selectAll('input[data-consequence]').each(function (this: HTMLInputElement) {
			if (this.checked) {
				consequences.push(this.getAttribute('data-consequence')!)
			}
		})

		if (!config.snvindelOptions) config.snvindelOptions = {}
		config.snvindelOptions.consequences = consequences

		return config
	}

	private async runAnalysis() {
		// Get the run button
		const runButton = this.dom.controls.select('button').node() as HTMLButtonElement
		const originalButtonText = runButton.textContent

		try {
			// Disable button and show loading state
			runButton.disabled = true
			runButton.textContent = 'Running Analysis...'
			runButton.style.background = '#cccccc'
			runButton.style.cursor = 'not-allowed'

			// Add overlay to prevent interactions
			const overlay = this.dom.div
				.append('div')
				.style('position', 'absolute')
				.style('top', '0')
				.style('left', '0')
				.style('width', '100%')
				.style('height', '100%')
				.style('background', 'rgba(255, 255, 255, 0.8)')
				.style('z-index', '1000')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('justify-content', 'center')

			// Add loading spinner
			overlay
				.append('div')
				.style('padding', '20px')
				.style('background', 'white')
				.style('border-radius', '8px')
				.style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)')
				.style('text-align', 'center').html(`
				<div style="margin-bottom: 10px;">
					<div style="border: 3px solid #f3f3f3; border-top: 3px solid #ccc; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
				</div>
				<div>Running GRIN2 analysis...</div>
			`)

			// Add CSS animation for spinner
			if (!document.getElementById('grin2-spinner-style')) {
				const style = document.createElement('style')
				style.id = 'grin2-spinner-style'
				style.textContent = `
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			`
				document.head.appendChild(style)
			}

			// Clear any previous errors and plot content
			this.dom.error.style('padding', '0').text('')
			this.dom.plot.selectAll('*').remove()

			// Get current configuration values
			const configValues = this.getConfigValues()

			// Make request to GRIN2 endpoint
			const requestData = {
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				filter: this.state.termfilter.filter,
				...configValues
			}

			const response = await dofetch3('/grin2', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestData)
			})

			const result = await response

			// Remove overlay
			overlay.remove()

			if (result.status === 'error') {
				this.dom.error.style('padding', '20px').text(`GRIN2 analysis failed: ${result.error}`)
				return
			}

			// Display results
			this.renderResults(result)
		} catch (error) {
			// Remove overlay if it exists
			this.dom.div.select('div[style*="z-index: 1000"]').remove()

			this.dom.plot.selectAll('*').remove()
			this.dom.error
				.style('padding', '20px')
				.text(`Error running GRIN2 analysis: ${error instanceof Error ? error.message : String(error)}`)
		} finally {
			// Re-enable button and restore original state
			runButton.disabled = false
			runButton.textContent = originalButtonText
			runButton.style.background = '#f0f0f0'
			runButton.style.cursor = 'pointer'
		}
	}

	async init() {
		await this.setControls()
	}

	async main() {
		// Only initialize the table, don't auto-run analysis
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		// Table is already created in setControls, just ensure plot area is clear
		this.dom.plot.selectAll('*').remove()
		this.dom.error.style('padding', '0').text('')
	}

	private renderResults(result: any) {
		// Display Manhattan plot
		if (result.pngImg) {
			const plotContainer = this.dom.plot.append('div').style('text-align', 'left').style('margin', '20px 0')

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
					// Create download link for the base64 image
					const link = document.createElement('a')
					link.href = `data:image/png;base64,${result.pngImg}`
					link.download = `grin2_manhattan_plot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.png`
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
				}
			})

			plotContainer
				.append('img')
				.attr('src', `data:image/png;base64,${result.pngImg}`)
				.style('max-width', '100%')
				.style('height', 'auto')
				.style('border', '1px solid #ccc')
		}
		// Display top genes table
		if (result.topGeneTable) {
			const tableContainer = this.dom.plot.append('div').style('margin', '20px 0')

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

		// Display timing information
		if (result.timing) {
			this.dom.plot
				.append('div')
				.style('margin', '20px 0')
				.style('font-size', '12px')
				.style('color', '#666')
				.text(
					`Analysis completed in ${result.timing.totalTime}s (Processing: ${result.timing.processingTime}s, GRIN2: ${result.timing.grin2Time}s)`
				)
		}
	}
}

export const grin2Init = getCompInit(GRIN2)
export const componentInit = grin2Init

export function getDefaultGRIN2Settings(overrides = {}) {
	const defaults: GRIN2Settings = {
		snvindelOptions: {
			minTotalDepth: 10,
			minAltAlleleCount: 2,
			consequences: [],
			hyperMutator: 1000
		},
		cnvOptions: {
			lossThreshold: -0.4,
			gainThreshold: 0.3,
			maxSegLength: 0,
			hyperMutator: 500
		}
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: GRIN2Opts, _app: MassAppApi) {
	const config = {
		chartType: 'grin2',
		settings: {
			controls: {},
			grin2: getDefaultGRIN2Settings(opts.overrides || {})
		}
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
